export type Throttled<T extends (...args: any[]) => void> = T & {
    /** Сбросить отложенный вызов (но не запрещать будущие). */
    clear: () => void;
    /** Полностью отменить будущие вызовы (пока не создашь новый троттлер). */
    cancel: () => void;
    /** Немедленно выполнить отложенный вызов (если есть). */
    flush: () => void;
};

export function throttle<T extends (...args: any[]) => void>(fn: T, ms: number): Throttled<T> {
    let last = 0;
    let timer: NodeJS.Timeout | null = null;
    let lastArgs: any[] | null = null;
    let cancelled = false;

    const invoke = (ctx: any, args: any[]) => {
        if (cancelled) return;
        last = Date.now();
        fn.apply(ctx, args);
    };

    const throttled = function (this: any, ...args: any[]) {
        if (cancelled) return;
        const now = Date.now();
        const remaining = ms - (now - last);

        if (remaining <= 0) {
            if (timer) { clearTimeout(timer); timer = null; }
            invoke(this, args);
        } else {
            lastArgs = args;
            if (!timer) {
                timer = setTimeout(() => {
                    timer = null;
                    if (lastArgs) {
                        invoke(this, lastArgs);
                        lastArgs = null;
                    }
                }, remaining);
            }
        }
    } as Throttled<T>;

    throttled.clear = () => {
        if (timer) clearTimeout(timer);
        timer = null;
        lastArgs = null;
    };

    throttled.cancel = () => {
        cancelled = true;
        if (timer) clearTimeout(timer);
        timer = null;
        lastArgs = null;
    };

    throttled.flush = function (this: any) {
        if (cancelled) return;
        if (timer) { clearTimeout(timer); timer = null; }
        if (lastArgs) {
            invoke(this, lastArgs);
            lastArgs = null;
        }
    };

    return throttled;
}
