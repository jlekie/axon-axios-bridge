import * as KoaRouter from 'koa-router';

import { PropsParams } from '../common';

export interface RouterProps {
    readonly prefix: string | undefined;
}
export abstract class ARouter implements RouterProps {
    public readonly prefix: string | undefined;

    public constructor(params: PropsParams<ARouter, keyof RouterProps, 'prefix'>) {
        this.prefix = params.prefix;
    }

    public abstract createRouter(): Promise<KoaRouter>;
}