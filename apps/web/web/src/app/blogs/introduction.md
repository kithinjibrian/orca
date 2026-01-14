# Why Orca?

> Because I got tired of pretending the way we build web apps makes sense.

Every new project starts the same way: I spin up a frontend repo. Then a backend repo. Then I spend three days playing ping pong between them; writing an endpoint, switching to the frontend to call it, back to the backend because I forgot a field, back to the frontend because the types don't line up.

It's madness. That's what it is.

Two repos. Two package.jsons. Two sets of environment variables. Two deployment pipelines. Two sets of bugs for what should be _one feature_.

And we all just... accept this? Like it's some law of nature?

I don't know who decided this was "best practice," but I'm exhausted.

The line dividing frontend and backend is a mirage. Just because the UI isn't being rendered on the server doesn't mean we have to build two separate apps when it was always meant to be one.

---

Here's what really gets me: the constant context switching.

I'm not just switching files; I'm switching _mental models_. Frontend brain, backend brain. Component lifecycle, request lifecycle. useState, database queries. CORS errors that only happen in production.

My brain isn't a distributed system. It's one person trying to remember what the API returns while also remembering how the form validation works while also trying to ship what the client actually asked for.

By the time I'm done wiring everything together, I've spent more time _connecting_ things than building them.

That's busywork.

---

## "Just use Next.js"

I tried. I really did.

Server Actions sounded perfect; write your backend logic right next to your components, no API routes, no boilerplate. Simple.

Except it wasn't.

The logic started bleeding everywhere. Components that were also database transactions. APIs that worked but felt fragile, like one wrong move and the whole thing would collapse.

I kept asking myself: should this validation live in the Server Action or the component? Should I query the database here or pass the data down? What happens if I need this logic somewhere else; do I extract it into a utility that's half server, half client?

Every decision felt wrong. Not because Next.js is bad, it's not, but because it's solving a different problem. It's optimized for rendering UI fast. The moment I tried to treat it like a real backend, it fought me.

Maybe I'm using it wrong. Maybe it's a skill issue. But here's the thing: _I shouldn't have to feel this uncertain about where my code belongs._

And honestly? I didn't enjoy writing it. That's my signal to stop.

---

## "What about HTMX?"

HTMX is elegant. I get why people love it.

But I couldn't get past the idea of my endpoints returning HTML instead of JSON.

What happens when I need a mobile app? A CLI tool? A webhook consumer? Do I build a second API that returns JSON? Do I parse HTML on the client? Suddenly I'm maintaining two response formats, or worse; rewriting the whole backend because I painted myself into a corner.

I've been burned by "this will be fine for now" decisions before. I wasn't interested in doing it again.

HTMX optimizes for simplicity today. I needed something that wouldn't punish me tomorrow.

---

## What I actually wanted

I didn't want a frontend _and_ a backend.  
I wanted **one app that does both**.

Something where:

- The API is real - JSON, proper REST, ready to power a mobile app or CLI if I need it
- The UI lives in the same codebase, sharing the same types, calling functions that feel local even when they're not
- The structure doesn't fall apart after six months when requirements change
- I can build a feature without opening twelve tabs, three terminals, and a browser with localhost:3000 and postman with localhost:5000
- I don't have to choose between "move fast" and "build it right"

One codebase. One deployment. One set of types. One place where business logic lives.

Not two repos pretending to be one app.

Is that really too much to ask? 🤷

---

## So I built Orca

Because I was _tired_, and nothing out there felt like it was built for someone like me; a solo dev who just wants to ship without fighting the tools every step of the way.

Orca is inspired by NestJS and Angular; frameworks that take structure seriously, that are opinionated in ways that actually help you. Orca just brings those ideas together in a way that makes sense for full-stack development.

One codebase.  
Clear separation between layers - controllers, services, UI - without artificial repo boundaries.  
A real API that can grow with you.  
UI rendering that doesn't feel like an afterthought.  
Shared types that don't drift because they can't - they're the same types.

---

## Is this for you?

Honestly? Maybe not.

If you like the frontend/backend split, if that workflow makes sense to you, if you've got a whole team with well-defined API contracts and dedicated frontend and backend developers; keep doing what works.

This isn't a crusade. I'm not trying to convert anyone.

But if you're a solo dev, or a small team, and you're tired of spending half your time wiring things together instead of building them?

If you've caught yourself thinking "there has to be a simpler way" while debugging CORS for the fifteenth time?

If you want to write code that feels like building something instead of assembling scaffolding?

Then yeah. Orca might be for you.

Because I built it for me, and I was thinking the same thing.

---

That's it. That's why Orca exists.

Not to change the world.  
Not to replace your stack.

But to make shipping flawless.
