/** Route synchronous setup failures and rejected GPU initialization to the UI. */
export async function startWithErrorBoundary(
  start: () => Promise<void>,
  onError: (error: unknown) => void,
): Promise<boolean> {
  try {
    await start();
    return true;
  } catch (error) {
    onError(error);
    return false;
  }
}
