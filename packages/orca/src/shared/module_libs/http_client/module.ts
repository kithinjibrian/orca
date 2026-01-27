import { Injectable, Module } from "@/shared";
import { Observable } from "rxjs";

type StreamMode = "json" | "text" | "ndjson" | "raw";

interface HttpOptions {
  stream?: StreamMode;
  init?: RequestInit;
  reviver?: (this: any, key: string, value: any) => any;
}

interface PostOptions<TBody = unknown> extends HttpOptions {
  body?: TBody;
}

@Injectable()
export class HttpClient {
  public get<T = unknown>(
    url: string,
    { stream = "json", reviver, init }: HttpOptions = {}
  ): Observable<T> {
    return new Observable<T>((subscriber) => {
      const controller = new AbortController();

      fetch(url, {
        method: "GET",
        ...init,
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }

          if (stream === "json") {
            const data = await res.json();
            subscriber.next(
              reviver ? JSON.parse(JSON.stringify(data), reviver) : data
            );
            subscriber.complete?.();
            return;
          }

          if (stream === "raw") {
            subscriber.next(res as T);
            subscriber.complete?.();
            return;
          }

          const reader = res.body?.getReader();
          if (!reader) {
            throw new Error("ReadableStream not supported");
          }

          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              if (stream === "ndjson" && buffer.trim()) {
                try {
                  subscriber.next(JSON.parse(buffer, reviver));
                } catch (err) {
                  console.warn("Failed to parse remaining buffer:", err);
                }
              }
              break;
            }

            const chunk = decoder.decode(value, { stream: true });

            if (stream === "text") {
              subscriber.next(chunk as T);
              continue;
            }

            if (stream === "ndjson") {
              buffer += chunk;
              const lines = buffer.split("\n");
              buffer = lines.pop()!;

              for (const line of lines) {
                if (line.trim()) {
                  try {
                    subscriber.next(JSON.parse(line, reviver));
                  } catch (err) {
                    console.error("Failed to parse NDJSON line:", line, err);
                  }
                }
              }
            }
          }

          subscriber.complete?.();
        })
        .catch((err) => {
          if (err.name === "AbortError") {
            console.log("Request aborted");
          }
          subscriber.error?.(err);
        });

      return () => {
        controller.abort();
      };
    });
  }

  public post<T = unknown, TBody = unknown>(
    url: string,
    { body, stream = "json", reviver, init }: PostOptions<TBody> = {}
  ): Observable<T> {
    const headers = new Headers(init?.headers);

    if (body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const processedBody =
      body !== undefined
        ? typeof body === "string"
          ? body
          : JSON.stringify(body)
        : undefined;

    return this.get<T>(url, {
      stream,
      reviver,
      init: {
        ...init,
        method: "POST",
        headers,
        body: processedBody,
      },
    });
  }

  public put<T = unknown, TBody = unknown>(
    url: string,
    options?: PostOptions<TBody>
  ): Observable<T> {
    return this.request<T, TBody>(url, "PUT", options);
  }

  public patch<T = unknown, TBody = unknown>(
    url: string,
    options?: PostOptions<TBody>
  ): Observable<T> {
    return this.request<T, TBody>(url, "PATCH", options);
  }

  public delete<T = unknown>(
    url: string,
    options?: HttpOptions
  ): Observable<T> {
    return this.get<T>(url, {
      ...options,
      init: {
        ...options?.init,
        method: "DELETE",
      },
    });
  }

  private request<T = unknown, TBody = unknown>(
    url: string,
    method: string,
    { body, stream = "json", reviver, init }: PostOptions<TBody> = {}
  ): Observable<T> {
    const headers = new Headers(init?.headers);

    if (body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const processedBody =
      body !== undefined
        ? typeof body === "string"
          ? body
          : JSON.stringify(body)
        : undefined;

    return this.get<T>(url, {
      stream,
      reviver,
      init: {
        ...init,
        method,
        headers,
        body: processedBody,
      },
    });
  }
}

@Module({
  providers: [HttpClient],
  exports: [HttpClient],
})
export class HttpClientModule {}
