export interface EditorSaveCoordinator {
  run<T>(operation: () => Promise<T>): Promise<T>
  idle(): Promise<void>
}

/**
 * Serializes persistence operations for one editor runtime without polling,
 * timers or extra storage. Failures are isolated so one rejected save does not
 * poison later work. The coordinator itself owns no note state or persistence.
 */
export function createEditorSaveCoordinator(): EditorSaveCoordinator {
  let tail: Promise<void> = Promise.resolve()

  function run<T>(operation: () => Promise<T>): Promise<T> {
    const result = tail.then(operation, operation)
    tail = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  return {
    run,
    idle: () => tail,
  }
}
