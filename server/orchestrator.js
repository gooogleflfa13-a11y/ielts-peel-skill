import { executeCommand } from './pipeline/executeCommand.js';

export async function runCommand(request, options = {}) {
  const execution = await executeCommand(request, options);
  return execution.result;
}

export async function runCommandStream({
  onChunk,
  onComplete,
  onError,
  ...request
}, options = {}) {
  try {
    await executeCommand(request, {
      ...options,
      stream: true,
      signal: request.signal,
      onEvent(event) {
        if (event.type === 'chunk') onChunk?.(event.content);
        else if (event.type === 'complete') onComplete?.(event.result);
        else if (event.type === 'error') onError?.(event.error);
      },
    });
  } catch (error) {
    if (request.signal?.aborted || error?.name === 'AbortError') return;
    onError?.(error);
  }
}
