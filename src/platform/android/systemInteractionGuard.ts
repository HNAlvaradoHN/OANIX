let activeSystemInteractions = 0

export function isAndroidSystemInteractionActive(): boolean {
  return activeSystemInteractions > 0
}

export async function withAndroidSystemInteraction<T>(operation: () => Promise<T>): Promise<T> {
  activeSystemInteractions += 1
  try {
    return await operation()
  } finally {
    activeSystemInteractions = Math.max(0, activeSystemInteractions - 1)
  }
}
