Orca makes file uploads pretty painless. You add type annotations to your function parameters and the compiler does the rest - generating all the upload code for frontend and backend.

## Here's How It Works

Say you've got a service on the server:

```ts
"use public";
import { Injectable } from "@kithinji/orca";

@Injectable()
export class UserService {
  public async createUser(
    name: string,
    email: string,
    avatar: Express.Multer.File,
    banners: Array<Express.Multer.File>,
  ) {
    /*...*/
  }
}
```

That's it. Single file? Use `Express.Multer.File`. Multiple files? Use `Array<Express.Multer.File>`.

## Don't Get Clever

The compiler won't dig into nested types, so keep things simple. Each parameter needs to be typed directly as:

- `Express.Multer.File`
- `Array<Express.Multer.File>`
- `Express.Multer.File[]`

No type aliases or fancy indirection.

## On the Frontend

Your component looks normal:

```tsx
"use client";
import { Component, signal } from "@kithinji/orca";
import { UserService } from "./user.service";

@Component()
export class UserForm {
  name = signal("");
  email = signal("");
  avatar = signal<File | null>(null);
  banners = signal<File[]>([]);

  constructor(private readonly userService: UserService) {}

  async create() {
    if (!this.avatar.value) return;

    await this.userService.createUser(
      this.name.value,
      this.email.value,
      this.avatar.value,
      this.banners.value,
    );
  }

  build() {
    return (
      <div>
        <input
          type="text"
          placeholder="Name"
          value={this.name.value}
          onInput={(e) => (this.name.value = e.currentTarget.value)}
        />

        <input
          type="email"
          placeholder="Email"
          value={this.email.value}
          onInput={(e) => (this.email.value = e.currentTarget.value)}
        />

        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            if (file) this.avatar.value = file;
          }}
        />

        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            const files = Array.from(e.currentTarget.files || []);
            this.banners.value = files;
          }}
        />

        <button onClick={() => this.create()}>Create User</button>
      </div>
    );
  }
}
```

Grab the files from your inputs and pass them straight to the service method. The framework handles everything else.

## What Actually Gets Generated

Quick refresher on `use public`: when you mark a service with it, the build tool creates HTTP endpoints for all public async methods. On the client, it replaces your service with a stub that makes fetch calls. You write server code, call it like it's local, and the framework does the wiring.

### The Generated Controller

Here's what the compiler spits out for our service:

```ts
import {
  Controller,
  Req,
  Post,
  Body,
  UseInterceptors,
  UploadedFiles,
} from "@kithinji/orca";
import { FileFieldsInterceptor } from "@kithinji/express";

@Controller("/api/user", {
  providedIn: "root",
})
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post("createUser")
  @UseInterceptors(
    FileFieldsInterceptor([{ name: "avatar" }, { name: "banners" }]),
  )
  uploadFile(
    @Req() request: Request,
    @Body() body: any,
    @UploadedFiles()
    files: Record<string, Express.Multer.File[]>,
  ) {
    this.userService.request = request;
    return this.userService.createUser(
      body.name,
      body.email,
      files.avatar[0],
      files.banners,
    );
  }
}
```

The controller uses `FileFieldsInterceptor` to pull files out of the multipart request. Regular data comes from the body, files come from the files object, then everything gets passed to your service.

The compiler looked at your type annotations, saw `Express.Multer.File` and `Array<Express.Multer.File>`, and knew it needed to handle `avatar` and `banners` as file uploads.

### The Client Stub

On the client, the compiler generates this:

```ts
import { Injectable } from "@kithinji/orca";

@Injectable()
export class UserService {
  public async createUser(
    name: string,
    email: string,
    avatar: Express.Multer.File,
    banners: Array<Express.Multer.File>,
  ) {
    const formData = new FormData();

    formData.append("name", name);
    formData.append("email", email);
    formData.append("avatar", avatar);

    banners.forEach((banner) => {
      formData.append("banners", banner);
    });

    let headers = this.createUserHeaders?.() || {};

    if (headers instanceof Promise) {
      headers = await headers;
    }

    const response = await fetch("/api/user/createUser", {
      method: "POST",
      headers,
      body: formData,
    });

    return response.json();
  }
}
```

All the FormData setup, the fetch call, everything - generated. You wrote type annotations once and got all this for free.

This stub gets bundled with your client code. From your component's view, you're just calling `this.userService.createUser()`. You have no idea there's a network request. You definitely didn't write any of this fetch code.

And since TypeScript sees the same signature on both sides, you get type safety across the network. Change the server signature and your client code breaks at compile time.

## File Validation Is Tricky

We haven't cracked this one yet.

You could try the `@Signature` decorator with Zod schemas, but here's the problem: by the time Zod runs, the file's already on the server.

Want to validate size, type, or dimensions before accepting the upload? Can't do it. Validation happens after the fact, so you've already burned bandwidth and CPU on a file that might get rejected anyway.

## Why This Is Cool

Look at what you didn't write:

- FormData creation code
- Fetch calls with multipart headers
- Route definitions
- Code to keep client and server in sync
- Anything involving field name strings

You typed some parameters and called a method.

Need another file upload? Add it to the signature with the right type. The compiler updates everything - controller, stub, all of it. You never look at the HTTP layer.
