export type PromisedType<T> = T extends Promise<infer U> ? U : T;
export type PropsParams<T, K extends keyof T, OK extends K = never> = Pick<T, Exclude<K, OK>> & Partial<Pick<T, OK>>;

export type EventHandler<T = never> = [T] extends [never] ? (() => void | Promise<void>) : ((data: T) => void | Promise<void>);

export interface EventSubscriberNoPayload {
    on(handler: EventHandler): this;
    off(handler: EventHandler): this;
}
export interface EventSubscriberWithPayload<T> {
    on(handler: EventHandler<T>): this;
    off(handler: EventHandler<T>): this;
}
export type EventSubscriber<T = never> = [T] extends [never] ? EventSubscriberNoPayload : EventSubscriberWithPayload<T>;

export class EventDispatcherNoPayload implements EventSubscriberNoPayload {
    private readonly handlers: EventHandler[] = [];

    public get hasListeners() {
        return this.handlers.length > 0;
    }

    public on(handler: EventHandler) {
        this.handlers.push(handler);

        return this;
    }
    public off(handler: EventHandler) {
        const index = this.handlers.indexOf(handler);
        if (index >= 0)
            this.handlers.splice(index, 1);

        return this;
    }

    public emit() {
        for (const handler of this.handlers)
            handler();

        return this;
    }
}
export class EventDispatcherWithPayload<T> implements EventSubscriberWithPayload<T> {
    private readonly handlers: EventHandler<T>[] = [];

    public get hasListeners() {
        return this.handlers.length > 0;
    }

    public on(handler: EventHandler<T>) {
        this.handlers.push(handler);

        return this;
    }
    public off(handler: EventHandler<T>) {
        const index = this.handlers.indexOf(handler);
        if (index >= 0)
            this.handlers.splice(index, 1);

        return this;
    }

    public emit(data: T) {
        for (const handler of this.handlers)
            handler(data);

        return this;
    }
}
// export type EventDispatcher<T = never> = [T] extends [never] ? EventDispatcherNoPayload : EventDispatcherWithPayload<T>;

export function createDispatcher(): EventDispatcherNoPayload;
export function createDispatcher<T>(hasPayload: true): EventDispatcherWithPayload<T>;
export function createDispatcher<T>(hasPayload?: true): EventDispatcherNoPayload | EventDispatcherWithPayload<T> {
    if (hasPayload)
        return new EventDispatcherWithPayload<T>();
    else
        return new EventDispatcherNoPayload();
}

export type EventCollectionDispatchers = Record<string, EventDispatcherNoPayload | EventDispatcherWithPayload<any>>;
export abstract class EventCollection<T extends EventCollectionDispatchers> {
    // public constructor(private dispatchers: T) {
    // }

    public on<K extends keyof T>(eventName: K, handler: Parameters<T[K]['on']>[0]) {
        const dispatchers = (this as any).dispatchers as T | undefined;
        if (dispatchers)
            dispatchers[eventName].on(handler as any);

        return this;
    }
    protected emit<K extends keyof T>(eventName: K, handler: ((emit: T[K]['emit']) => void)) {
        const dispatchers = (this as any).dispatchers as T | undefined;
        if (dispatchers)
            handler(dispatchers[eventName].emit.bind(dispatchers[eventName]));

        return this;
    }
}

// export class EventDispatcherCollection<T extends EventCollectionDispatchers> {
//     public [P in keyof T]: string;
// }

export type MappedEmitterType<T extends Record<string, unknown>> = {
    [P in keyof T]: [T[P]] extends [never] ? EventDispatcherNoPayload : EventDispatcherWithPayload<T[P]>
};
// export type EventEmitterParams = Record<string, EventDispatcherNoPayload | EventDispatcherWithPayload<any>>;
export class EventEmitter<T extends EventCollectionDispatchers> {
    public constructor(private dispatchers: T) {
    }

    public on<K extends keyof T>(eventName: K, handler: ((emit: T[K]['emit']) => void)) {
        handler(this.dispatchers[eventName].emit.bind(this.dispatchers[eventName]));

        return this;
    }
}