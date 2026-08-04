export class EmailSourceAdapter {
  constructor({ id, label }) {
    this.id = id;
    this.label = label;
  }

  async isAvailable() { return false; }
  async searchMessages() { throw new Error("Email source search is not implemented"); }
  async getMessage() { throw new Error("Email source message retrieval is not implemented"); }
  async getThread() { throw new Error("Email source thread retrieval is not implemented"); }
  async getSafeMessageContent() { throw new Error("Safe email content retrieval is not implemented"); }
  async getAttachmentMetadata() { return []; }

  // Intentionally no send/reply/delete/archive/move/label methods.
}

export default EmailSourceAdapter;
