// export type DebouncedFunction<T extends (...args: any[]) => any> = {
// 	(...args: Parameters<T>): void;
// 	cancel: () => void;
// 	flush: () => ReturnType<T> | undefined;
// };

// export function debounce<T extends (...args: any[]) => any>(
// 	fn: T,
// 	delay = 300
// ): DebouncedFunction<T> {
// 	let timer: ReturnType<typeof setTimeout> | undefined;
// 	let lastArgs: Parameters<T> | undefined;
// 	let lastThis: ThisParameterType<T> | undefined;
// 	let lastResult: ReturnType<T> | undefined;

// 	const debounced = function (this: ThisParameterType<T>, ...args: Parameters<T>) {
// 		lastArgs = args;
// 		lastThis = this;

// 		if (timer) {
// 			clearTimeout(timer);
// 		}

// 		timer = setTimeout(() => {
// 			timer = undefined;
// 			if (lastArgs) {
// 				lastResult = fn.apply(lastThis as ThisParameterType<T>, lastArgs);
// 				lastArgs = undefined;
// 				lastThis = undefined;
// 			}
// 		}, delay);
// 	} as DebouncedFunction<T>;

// 	debounced.cancel = () => {
// 		if (timer) {
// 			clearTimeout(timer);
// 			timer = undefined;
// 		}
// 		lastArgs = undefined;
// 		lastThis = undefined;
// 	};

// 	debounced.flush = () => {
// 		if (timer) {
// 			clearTimeout(timer);
// 			timer = undefined;
// 		}

// 		if (!lastArgs) {
// 			return lastResult;
// 		}

// 		lastResult = fn.apply(lastThis as ThisParameterType<T>, lastArgs);
// 		lastArgs = undefined;
// 		lastThis = undefined;
// 		return lastResult;
// 	};

// 	return debounced;
// }

export function debounce<T extends (...args: any[]) => Promise<void>>(
  callback: T,
  delay: number,
) {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);

    timeoutId = setTimeout(async () => {
      await callback(...args);
    }, delay);
  };
}
