# Signals

## What are Signals?

Signals are reactive values that automatically notify subscribers when they change.

---

## 1: The Basic Signal

Let's start with a simple container for a value:

```js
function signal(initialValue) {
  let value = initialValue;

  return {
    get value() {
      return value;
    },
    set value(newValue) {
      value = newValue;
    },
  };
}

const count = signal(0);
console.log(count.value); // 0
count.value = 5;
console.log(count.value); // 5
```

This works, but it's not reactive yet. When we change `count.value`, nothing else knows about it.

---

## 2: Adding Subscribers

Let's add the ability to listen for changes:

```js
function signal(initialValue) {
  let value = initialValue;
  let subscribers = [];

  return {
    get value() {
      return value;
    },
    set value(newValue) {
      value = newValue;
      // Tell everyone who's listening
      subscribers.forEach((callback) => callback(newValue));
    },
    subscribe(callback) {
      subscribers.push(callback);
    },
  };
}

const count = signal(0);

count.subscribe((newValue) => {
  console.log("Count changed to:", newValue);
});

count.value = 5; // "Count changed to: 5"
count.value = 10; // "Count changed to: 10"
```

Now we have notifications!

---

## 3: Avoiding Unnecessary Updates

Right now, even setting the same value triggers notifications:

```js
const count = signal(5);
count.subscribe(() => console.log("Updated!"));

count.value = 5; // "Updated!" (but nothing changed!)
count.value = 5; // "Updated!" again
```

Let's only notify when the value actually changes:

```js
function signal(initialValue) {
  let value = initialValue;
  let subscribers = [];

  return {
    get value() {
      return value;
    },
    set value(newValue) {
      // Only update if different
      if (value !== newValue) {
        value = newValue;
        subscribers.forEach((callback) => callback(newValue));
      }
    },
    subscribe(callback) {
      subscribers.push(callback);
    },
  };
}

const count = signal(5);
count.subscribe(() => console.log("Updated!"));

count.value = 5; // Nothing happens (value unchanged)
count.value = 10; // prints: "Updated!"
```

Much better! But we need to unsubscribe otherwise we will have memory leaks.

---

## 4: Unsubscribing

Let's return a function that removes the subscription:

```js
function signal(initialValue) {
  let value = initialValue;
  let subscribers = [];

  return {
    get value() {
      return value;
    },
    set value(newValue) {
      if (value !== newValue) {
        value = newValue;
        subscribers.forEach((callback) => callback(newValue));
      }
    },
    subscribe(callback) {
      subscribers.push(callback);

      // Return unsubscribe function
      return () => {
        subscribers = subscribers.filter((cb) => cb !== callback);
      };
    },
  };
}

const count = signal(0);

const unsubscribe = count.subscribe((val) => {
  console.log("Count:", val);
});

count.value = 10; // prints: "Count: 10"
unsubscribe(); // Stop listening
count.value = 20; // Nothing printed
```

---

## 5: Effects

Manually subscribing is tedious. Let's create `effect()` - a function that automatically runs whenever signals it uses change:

```js
function signal(initialValue) {
  let value = initialValue;
  let subscribers = [];

  return {
    get value() {
      return value;
    },
    set value(newValue) {
      if (value !== newValue) {
        value = newValue;
        subscribers.forEach((callback) => callback(newValue));
      }
    },
    subscribe(callback) {
      subscribers.push(callback);
      return () => {
        subscribers = subscribers.filter((cb) => cb !== callback);
      };
    },
  };
}

function effect(fn) {
  fn(); // Run immediately
}

const count = signal(0);
const name = signal("Alice");

effect(() => {
  console.log(`${name.value} has ${count.value} points`);
});
// prints: "Alice has 0 points"

count.value = 10;
// Nothing happens! We need tracking...
```

The effect runs once, but it doesn't automatically re-run when signals change.

---

## 6: Automatic Dependency Tracking

Here's the trick: when a signal is read inside an effect, it automatically subscribes:

```js
let currentEffect = null;

function signal(initialValue) {
  let value = initialValue;
  let subscribers = new Set(); // Use Set to avoid duplicates

  return {
    get value() {
      // If we're inside an effect, auto-subscribe
      if (currentEffect) {
        subscribers.add(currentEffect);
      }
      return value;
    },
    set value(newValue) {
      if (value !== newValue) {
        value = newValue;
        subscribers.forEach((callback) => callback());
      }
    },
  };
}

function effect(fn) {
  const execute = () => {
    currentEffect = execute;
    fn();
    currentEffect = null;
  };
  execute();
}

const name = signal("Alice");

effect(() => {
  console.log(`Name: '${name.value}'`);
});
// prints: "Name: 'Alice'"

name.value = "Bob";
// prints: "Name: 'Bob'"
```

Now it's reactive!

---

## 7: Cleaning Up Dependencies

There's a problem with our current implementation. Effects accumulate dependencies even when they stop using certain signals:

```js
const show = signal(true);
const count = signal(0);

effect(() => {
  if (show.value) {
    console.log("Count:", count.value);
  }
  // When show is false, we don't read count, but we're still subscribed to it
});
// Prints: "Count: 0"

show.value = false;
// Prints nothing (because show is false and we don't read count)

count.value = 10;
// Still prints nothing (because show is still false)
// BUT we're still subscribed to count unnecessarily!

count.value = 20;
// Prints nothing again
// The effect runs each time count changes, even though it does nothing
```

The effect is still subscribed to `count` even when it doesn't use it. Let's fix this by cleaning up dependencies before each run:

```js
let currentEffect = null;

function signal(initialValue) {
  let value = initialValue;
  let subscribers = new Set();

  return {
    get value() {
      if (currentEffect) {
        subscribers.add(currentEffect);
        // Store cleanup function in the effect
        currentEffect.dependencies.add(() => subscribers.delete(currentEffect));
      }
      return value;
    },
    set value(newValue) {
      if (value !== newValue) {
        value = newValue;
        subscribers.forEach((fn) => fn());
      }
    },
  };
}

function effect(fn) {
  const execute = () => {
    // Clean up old dependencies before re-running
    execute.dependencies.forEach((cleanup) => cleanup());
    execute.dependencies.clear();

    currentEffect = execute;
    fn();
    currentEffect = null;
  };

  execute.dependencies = new Set();
  execute();
}

const show = signal(true);
const count = signal(0);

effect(() => {
  if (show.value) {
    console.log("Count:", count.value);
  }
});
// Prints: "Count: 0"

show.value = false;
// Effect runs (subscribed to show), but prints nothing

count.value = 10;
// Nothing happens! Effect is no longer subscribed to count
```

Now effects only stay subscribed to signals they actually read each time they run.

---

## 8: Computed Signals

Often you want signals derived from other signals:

```js
function computed(fn) {
  const result = signal(undefined);

  effect(() => {
    result.value = fn();
  });

  return result;
}

const firstName = signal("John");
const lastName = signal("Doe");

const fullName = computed(() => {
  return `${firstName.value} ${lastName.value}`;
});

console.log(fullName.value); // "John Doe"

firstName.value = "Jane";
console.log(fullName.value); // "Jane Doe"

// Computed signals can be used in other effects
effect(() => {
  console.log("Full name is:", fullName.value);
});
// Prints: "Full name is: Jane Doe"

lastName.value = "Smith";
// Prints: "Full name is: Jane Smith"
```
