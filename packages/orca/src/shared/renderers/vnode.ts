export class VNode {
  id?: string;
  parent?: VNode;
  children: VNode[] = [];

  constructor(public dom: Node, private cb?: (old: Node, nw: Node) => void) {}

  setId(id: string) {
    this.id = id;
  }

  addChild(child: VNode): VNode {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  removeChild(child: VNode): void {
    const index = this.children.indexOf(child);
    if (index > -1) {
      this.children.splice(index, 1);
      child.parent = undefined;
    }
  }

  findById(id: string): VNode | null {
    if (this.id === id) return this;

    for (const child of this.children) {
      const found = child.findById(id);
      if (found) return found;
    }

    return null;
  }

  attach(nw: Node) {
    if (this.cb) {
      this.cb(this.dom, nw);
    } else {
      if (this.dom.parentNode) {
        this.dom.parentNode.replaceChild(nw, this.dom);
      }
    }
    this.dom = nw;
  }

  unmount(): void {
    for (const child of this.children) {
      child.unmount();
    }

    if (this.dom.parentNode) {
      this.dom.parentNode.removeChild(this.dom);
    }

    if (this.parent) {
      this.parent.removeChild(this);
    }
  }
}
