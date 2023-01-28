class MessageQueue {
  private static _instance: MessageQueue;
  private _messages: string[];

  private constructor() {
    this._messages = [];
  }

  public static getInstance() {
    if (!this._instance) {
      this._instance = new MessageQueue();
    }
    return this._instance;
  }

  public enqueue(message: string) {
    this._messages.push(message);
  }

  public dequeue() {
    if (this._messages.length > 0) {
      return this._messages.splice(0, 1)[0];
    }
    return null;
  }
}

export default MessageQueue;
