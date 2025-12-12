// Simple generic pool
export class Pool<T> {
  private items: T[] = []

  constructor (initial: T[] = []) {
    this.items = initial
  }

  acquire (): T | undefined {
    return this.items.pop()
  }

  release (item: T) {
    this.items.push(item)
  }

  size () {
    return this.items.length
  }

  pushMany (items: T[]) {
    this.items.push(...items)
  }
}

