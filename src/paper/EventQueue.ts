import { ClusterId, SplitEvent, Timestamp } from "./types";
import FastPriorityQueue  from 'fastpriorityqueue'


export class EventQueue {

  private readonly queue: FastPriorityQueue<SplitEvent> = new FastPriorityQueue((event1, event2) => event1.splitTime < event2.splitTime)
  private readonly inQueue: Set<ClusterId> = new Set()

  addOrUpdate(id: ClusterId, splitTime: Timestamp) {
    if (this.inQueue.has(id)) {
      this.removeFromQueue(id)
    } else {
      this.inQueue.add(id)
    }
    this.queue.add({ cluster: id, splitTime })
  }

  remove(id: ClusterId) {
    if (this.inQueue.delete(id)) {
      this.removeFromQueue(id)
    }
  }

  peek(): SplitEvent | undefined {
    return this.queue.peek()
  }

  pop(): SplitEvent | undefined  {
    return this.queue.poll()
  }

  private removeFromQueue(id: ClusterId) {
    this.queue.removeOne(({ cluster }) => cluster === id)
  }

}
