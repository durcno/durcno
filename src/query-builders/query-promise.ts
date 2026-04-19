/** biome-ignore-all lint/suspicious/noExplicitAny: <> */
import type { Query } from "./query";

export abstract class QueryPromise<T> implements Promise<T> {
  [Symbol.toStringTag] = "QueryPromise";

  catch<TResult = never>(
    onRejected?:
      | ((reason: any) => TResult | PromiseLike<TResult>)
      | null
      | undefined,
  ): Promise<T | TResult> {
    return this.then(undefined, onRejected);
  }

  finally(onFinally?: (() => void) | null | undefined): Promise<T> {
    return this.then(
      (value) => {
        onFinally?.();
        return value;
      },
      (reason) => {
        onFinally?.();
        throw reason;
      },
    );
  }

  // biome-ignore lint/suspicious/noThenProperty: <Required for awaiting a query>
  then<TResult1 = T, TResult2 = never>(
    onFulfilled:
      | ((value: T) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onRejected:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onFulfilled).catch(onRejected);
  }

  abstract toQuery(): Query<T>;
  abstract execute(): Promise<T>;
  abstract handleRows(rows: any[]): T;
}
