#!/usr/bin/env node

import 'source-map-support/register';

import * as _ from 'lodash';

import * as Yargs from 'yargs';
import { Argv } from 'yargs';

import * as Path from 'path';

import * as Chalk from 'chalk';

import * as Zod from 'zod';

import * as App from '.';

const argv = (Yargs)
    .env('SERVER')
    .option('hostname', {
        string: true,
        default: '0.0.0.0',
        description: 'Host interface to listen on'
    })
    .option('port', {
        number: true,
        default: 8080,
        description: 'Port to listen on'
    })
    .option('nucleus', {
        string: true,
        required: true,
        description: 'Backend ZMQ service bus URL'
    })
    .option('authorized-apps', {
        alias: 'authorized-app',
        string: true,
        array: true,
        default: [],
        coerce: (value) => {
            const apps = Zod.array(Zod.string()).parse(value);

            return _.flatMap(apps, app => {
                const items = app.split(' ');

                return items.map(app => {
                    const [ name, key ] = Zod.tuple([ Zod.string(), Zod.string() ]).parse(app.split(':', 2));

                    return {
                        name,
                        key
                    };
                });
            });
        },
        description: 'Authorized application keys'
    })
    .help('h')
    .alias('h', 'help')
    .showHelpOnFail(true)
    .wrap(null)
    .argv;

const OPTIONS_SCHEMA = Zod.object({
    hostname: Zod.string(),
    port: Zod.number(),
    nucleus: Zod.string(),
    authorizedApps: Zod.array(Zod.object({
        name: Zod.string(),
        key: Zod.string()
    }))
}).nonstrict();

(async () => {
    const options = OPTIONS_SCHEMA.parse(argv);

    console.log(Chalk.gray('Initializing server...'));
    const server = await App.createServer({
        hostname: options.hostname,
        port: options.port,
        url: options.nucleus,
        authorizedApps: options.authorizedApps
    });

    server.on('error', (err) => {
        console.log(Chalk.red(err.message));
        console.log(err.stack);
    }).on('listening', () => {
        console.log(Chalk.cyan(`Server "${server.name}" listening on ${server.hostname}:${server.port}`));
    }).on('requestHandled', (ctx) => {
        console.log(Chalk.gray(`${ctx.ip} - - [${ctx.startTime.toUTCString()}] "${ctx.method} ${ctx.originalUrl} HTTP/${ctx.httpVersion}" ${ctx.status} ${ctx.duration}ms`));
    });

    console.log(Chalk.gray('Starting server...'));
    await server.run();
})().then(() => {
    console.log(Chalk.green('Done'));
}).catch((err) => {
    console.log(Chalk.red(err.message));
    console.log(err.stack);

    process.exit(1);
});