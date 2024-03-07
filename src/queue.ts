export class PromiseQueue {
  maxConcurrentRequests: number;
  requestQueue: (() => Promise<unknown>)[] = [];
  activeRequests = 0;
  constructor(maxConcurrentRequests: number) {
    this.maxConcurrentRequests = maxConcurrentRequests;
  }
  addRequest(requestFunc: () => Promise<unknown>) {
    this.requestQueue.push(requestFunc);
    this.processQueue();
  }
  processQueue() {
    if (this.requestQueue.length === 0) return;
    if (this.activeRequests >= this.maxConcurrentRequests) return;
    this.requestQueue.shift()!().finally(() => {
      this.activeRequests--;
      this.processQueue();
    });
    // console.log(this.activeRequests);
    this.activeRequests++;
    this.processQueue();
  }
}
