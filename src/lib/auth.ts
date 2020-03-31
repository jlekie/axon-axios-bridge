// import * as KoaPassport from 'koa-passport';
// import { Strategy as LocalStrategy } from 'passport-local';

// import { PropsParams } from './common';

// export interface AuthorizedAppProps {
//     readonly name: string;
//     readonly keys: readonly string[];
// }
// export class AuthorizedApp {
//     public readonly name: string;
//     public readonly keys: readonly string[];

//     public constructor(params: PropsParams<AuthorizedApp, keyof AuthorizedAppProps, 'keys'>) {
//         this.name = params.name;
//         this.keys = params.keys || [];
//     }
// }

// const APPS = [
//     new AuthorizedApp({
//         name: 'test',
//         keys: [
//             '123abc'
//         ]
//     })
// ];

// export function initializePassport() {
//     KoaPassport.serializeUser<AuthorizedApp, string>((user, done) => {
//         done(null, user.name);
//     });

//     KoaPassport.deserializeUser<AuthorizedApp, string>(async (id, done) => {
//         const app = APPS.find(a => a.name === id);
//         done(null, app);
//     });

//     KoaPassport.use(new LocalStrategy((username, password, done) => {
//         const app = APPS.find(a => a.name === username && a.keys.indexOf(password) >= 0);
//         if (!app)
//             return done(null, false);

//         return done(null, app);
//     }));
// }