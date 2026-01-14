"use interactive";

import { Component, JSX } from "@kithinji/orca";

@Component()
export class Button {
    props!: {
        children: any
    };
    
    build() {
        return (
            <button>
                {this.props.children}
            </button>
        );
    }
}
