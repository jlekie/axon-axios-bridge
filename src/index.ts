import * as Path from 'path';
import * as FS from 'fs-extra';

import * as Faker from 'faker';

import * as Zod from 'zod';

import { Server } from './lib/server';
import { ForwarderRouter } from './lib/router';

export interface CreateServerParams {
    hostname: ConstructorParameters<typeof Server>[0]['hostname'];
    port: ConstructorParameters<typeof Server>[0]['port'];
    url: ConstructorParameters<typeof ForwarderRouter>[0]['url'];
    authorizedApps?: ConstructorParameters<typeof ForwarderRouter>[0]['authorizedApps'];
}
export async function createServer(params: CreateServerParams) {
    const { hostname, port, url, authorizedApps } = params;

    const name = Faker.commerce.productName();
    const version = (await loadPackage()).version;

    const routers = [
        new ForwarderRouter({
            url,
            authorizedApps
        })
    ];

    return new Server({
        name,
        version,
        hostname,
        port,
        routers
    });
}

const PACKAGE_SCHEMA = Zod.object({
    name: Zod.string(),
    version: Zod.string()
}).nonstrict();
async function loadPackage() {
    const packageHash = await FS.readJson(Path.resolve(__dirname, '../package.json'));

    return PACKAGE_SCHEMA.parse(packageHash);
}

export * from './lib/server';
export * from './lib/router';