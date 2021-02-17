import * as Bluebird from 'bluebird';
import * as Chalk from 'chalk';

import * as Path from 'path';

import * as Http from 'http';
import * as Koa from 'koa';
import * as KoaRouter from 'koa-router';
import * as KoaCors from 'koa-cors';
// import * as KoaPassport from 'koa-passport';

import * as Zod from 'zod';

import { PromisedType, PropsParams, createDispatcher, EventSubscriber, EventCollection, EventEmitter, EventDispatcherWithPayload, EventDispatcherNoPayload } from './common';
import { ARouter } from './router';

// function applyMixins(derivedCtor: any, baseCtors: any[]) {
//     baseCtors.forEach(baseCtor => {
//         Object.getOwnPropertyNames(baseCtor.prototype).forEach(name => {
//             const propDescriptor = Object.getOwnPropertyDescriptor(baseCtor.prototype, name);
//             if (!propDescriptor)
//                 throw new Error();

//             Object.defineProperty(derivedCtor.prototype, name, propDescriptor);
//         });
//     });
// }

export interface RequestHandledParams {
    readonly ip: string;
    readonly startTime: Date;
    readonly method: string;
    readonly originalUrl: string;
    readonly httpVersion: string;
    readonly status: number;
    readonly duration: number;
}

export interface ServerProps {
    readonly name: string;
    readonly version: string;
    readonly hostname: string;
    readonly port: number;

    readonly routers: readonly ARouter[];
}
export class Server implements ServerProps {
    public readonly name: string;
    public readonly version: string;
    public readonly hostname: string;
    public readonly port: number;

    public readonly routers: readonly ARouter[];

    private dispatchers = {
        error: createDispatcher<Error>(true),
        requestHandled: createDispatcher<RequestHandledParams>(true),
        listening: createDispatcher()
    };

    private isRunning = false;
    private runningPromise: Promise<any> | undefined;

    public constructor(params: PropsParams<Server, keyof ServerProps, 'routers'>) {
        this.name = params.name;
        this.version = params.version;
        this.hostname = params.hostname;
        this.port = params.port;
        this.routers = params.routers || [];
    }

    public on<K extends keyof Server['dispatchers']>(eventName: K, handler: Parameters<Server['dispatchers'][K]['on']>[0]) {
        this.dispatchers[eventName].on(handler as any);

        return this;
    }
    private emit<K extends keyof Server['dispatchers']>(eventName: K, handler: ((emit: Server['dispatchers'][K]['emit']) => void)) {
        if (this.dispatchers[eventName].hasListeners)
            handler(this.dispatchers[eventName].emit.bind(this.dispatchers[eventName]));

        return this;
    }

    public async start() {
        if (!this.isRunning) {
            this.isRunning = true;

            const context = await this.initialize();
            this.runningPromise = this.handler(context);
        }
    }
    public async stop() {
        this.isRunning = false;
        await this.runningPromise;
    }
    public async run() {
        await this.start();
        await this.runningPromise;
    }

    private async initialize() {
        const app = new Koa();

        app.on('error', (err) => this.emit('error', emit => emit(err)));

        app.use(async (ctx, next) => {
            const startTime = new Date();

            try {
                await next();
            }
            catch (err) {
                ctx.status = err.status || 500;
                ctx.body = err.message;
                ctx.app.emit('error', err, ctx);
            }

            const endTime = new Date();
            const duration = endTime.getTime() - startTime.getTime();

            this.emit('requestHandled', emit => emit({
                ip: ctx.request.ip,
                startTime,
                method: ctx.method,
                originalUrl: ctx.originalUrl,
                httpVersion: ctx.req.httpVersion,
                status: ctx.status,
                duration
            }));
        });

        app.use(async (ctx, next) => {
            try {
                await next();
            }
            catch (err) {
                if (err instanceof Zod.ZodError) {
                    ctx.throw(400, err);
                }
                else {
                    ctx.throw(err);
                }
            }
        });

        app.use(KoaCors());

        // app.use(KoaPassport.initialize());

        const rootRouter = new KoaRouter();

        const janusRouter = this.createGreeterRouter();
        rootRouter.use('/_server', janusRouter.routes(), janusRouter.allowedMethods());

        for (const router of this.routers) {
            const koaRouter = await router.createRouter();
            rootRouter.use(koaRouter.routes(), koaRouter.allowedMethods());
        }

        app.use(rootRouter.routes()).use(rootRouter.allowedMethods());

        const httpServer = Http.createServer(app.callback());

        // Wait for HTTP server to start listening for connections.
        await new Promise<void>((resolve, reject) => {
            httpServer.listen(this.port, this.hostname, () => {
                try {
                    this.emit('listening', emit => emit());

                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            });
        });

        return {
            app,
            httpServer
        };
    }
    private async handler(context: PromisedType<ReturnType<Server['initialize']>>) {
        while (this.isRunning) {
            await Bluebird.delay(5000);
        }

        await new Promise<void>((resolve, reject) => {
            try {
                context.httpServer.close((err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            }
            catch (err) {
                reject(err);
            }
        });
    }

    private createGreeterRouter() {
        const router = new KoaRouter();

        router.get('/', (ctx, next) => {
            ctx.body = `Axon HTTP Bridge v${this.version} / "${this.name}"`;
        });
        router.get('/details', (ctx, next) => {
            ctx.body = {
                serverName: this.name,
                serverVersion: this.version
            };
        });

        return router;
    }
}

// export interface Server extends EventCollection<Server['dispatchers']> {}
// applyMixins(Server, [ EventCollection ]);