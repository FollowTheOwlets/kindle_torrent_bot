export function throttle<T extends (...args: any[]) => void>(fn: T, ms: number): T {
    let last = 0;
    let timer: NodeJS.Timeout | null = null;
    let lastArgs: any[] | null = null;

    const invoke = (ctx: any, args: any[]) => {
        last = Date.now();
        fn.apply(ctx, args);
    };

    return function (this: any, ...args: any[]) {
        const now = Date.now();
        const remaining = ms - (now - last);

        if (remaining <= 0) {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            invoke(this, args);
        } else {
            lastArgs = args;
            if (!timer) {
                timer = setTimeout(() => {
                    timer = null;
                    invoke(this, lastArgs!);
                    lastArgs = null;
                }, remaining);
            }
        }
    } as T;
}
