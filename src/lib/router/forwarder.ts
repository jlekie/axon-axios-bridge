import { OmitProperties } from 'ts-essentials';

import * as _ from 'lodash';

import * as KoaRouter from 'koa-router';
import * as KoaBodyParser from 'koa-bodyparser';
import * as KoaPassport from 'koa-passport';

import * as Zod from 'zod';

import * as Axon from '@jlekie/axon';
import * as AxonZmq from '@jlekie/axon-zeromq';

import { PropsParams } from '../common';

import { ARouter, RouterProps } from './base';

export const MESSAGE_SCHEMA = Zod.object({
    payload: Zod.string(),
    metadata: Zod.array(Zod.object({
        id: Zod.string(),
        data: Zod.string()
    }))
});

export interface AuthorizedApp {
    readonly name: string;
    readonly key: string;
}

export interface ForwarderRouterProps extends RouterProps {
    readonly url: string;
    readonly authorizedApps: readonly AuthorizedApp[];
}
export class ForwarderRouter extends ARouter {
    public readonly url: string;
    public readonly authorizedApps: readonly AuthorizedApp[];

    public constructor(params: PropsParams<ForwarderRouter, keyof ForwarderRouterProps, 'prefix' | 'authorizedApps'>) {
        super(params);

        this.url = params.url;
        this.authorizedApps = params.authorizedApps || [];
    }

    public async createRouter() {
        const router = new KoaRouter({
            prefix: this.prefix
        });

        const endpoint = AxonZmq.TcpClientEndpoint.fromUrl(this.url);
        const transport = new AxonZmq.DealerClientTransport(endpoint);
        await transport.connect(30000);

        router.use(async (ctx, next) => {
            const authHeader = ctx.request.get('Authorization');
            if (!authHeader)
                return ctx.throw(401);

            const [ type, encodedCredentials ] = authHeader.split(' ', 2);
            switch (type) {
                case 'Basic':
                    const [ username, password ] = Buffer.from(encodedCredentials, 'base64').toString('utf8').split(':', 2);
                    if (username !== 'test' || password !== '123abc')
                        return ctx.throw(401);

                    break;

                default:
                    return ctx.throw(401, `Unsupported auth scheme ${type}`);
            }

            await next();
        });

        router.use(KoaBodyParser());

        router.post(`/send`, async (ctx, next) => {
            const body = MESSAGE_SCHEMA.parse(ctx.request.body);

            const payload = Buffer.from(body.payload, 'base64');
            const metadata = body.metadata.map(m => new Axon.VolatileTransportMetadataFrame(m.id, Buffer.from(m.data, 'base64')));

            const message = new Axon.TransportMessage(payload, new Axon.VolatileTransportMetadata(metadata));

            await transport.send(message);

            ctx.status = 200;
        });
        router.post(`/receive`, async (ctx, next) => {
            const message = await transport.receive();

            ctx.body = {
                payload: message.payload.toString('base64'),
                metadata: message.metadata.frames.map(frame => ({
                    id: frame.id,
                    data: frame.data.toString('base64')
                }))
            };
            ctx.status = 200;
        });
        router.post(`/send-tagged`, async (ctx, next) => {
            const messageId = Zod.string().parse(ctx.request.query.mid);
            const body = MESSAGE_SCHEMA.parse(ctx.request.body);

            const payload = Buffer.from(body.payload, 'base64');
            const metadata = body.metadata.map(m => new Axon.VolatileTransportMetadataFrame(m.id, Buffer.from(m.data, 'base64')));

            const message = new Axon.TransportMessage(payload, new Axon.VolatileTransportMetadata(metadata));

            await transport.sendTagged(messageId, message);

            ctx.status = 200;
        });
        router.post(`/receive-tagged`, async (ctx, next) => {
            const messageId = Zod.string().parse(ctx.request.query.mid);
            const message = await transport.receiveTagged(messageId);

            ctx.body = {
                payload: message.payload.toString('base64'),
                metadata: message.metadata.frames.map(frame => ({
                    id: frame.id,
                    data: frame.data.toString('base64')
                }))
            };
            ctx.status = 200;
        });

        return router;
    }
}