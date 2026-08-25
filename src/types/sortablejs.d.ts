declare module 'sortablejs' {
  export interface SortableMoveEvent {
    dragged: HTMLElement
    related: HTMLElement
  }

  export interface SortableEvent {
    item: HTMLElement
    from: HTMLElement
    to: HTMLElement
    oldIndex?: number
    newIndex?: number
  }

  export interface SortableOptions {
    animation?: number
    easing?: string
    delay?: number
    delayOnTouchOnly?: boolean
    touchStartThreshold?: number
    forceFallback?: boolean
    fallbackOnBody?: boolean
    fallbackTolerance?: number
    fallbackClass?: string
    chosenClass?: string
    ghostClass?: string
    dragClass?: string
    draggable?: string
    filter?: string | ((event: Event, target: HTMLElement, sortable: Sortable) => boolean)
    preventOnFilter?: boolean
    direction?: 'vertical' | 'horizontal'
    swapThreshold?: number
    invertSwap?: boolean
    scroll?: boolean
    scrollSensitivity?: number
    scrollSpeed?: number
    bubbleScroll?: boolean
    dataIdAttr?: string
    supportPointer?: boolean
    onChoose?: (event: SortableEvent) => void
    onStart?: (event: SortableEvent) => void
    onMove?: (event: SortableMoveEvent) => boolean | -1 | 1 | void
    onEnd?: (event: SortableEvent) => void
  }

  export default class Sortable {
    static create(element: HTMLElement, options?: SortableOptions): Sortable
    destroy(): void
    option(name: string, value?: unknown): unknown
  }
}
