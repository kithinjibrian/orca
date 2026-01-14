# Cache Dependency Graph Specification

## Overview

This specification describes a cache invalidation system based on a dependency graph.

## Core Principle

## Dependency Graph Structure

The dependency graph is a **directed acyclic graph (DAG)** where:

- **Nodes** = cache keys (e.g., `product:123`, `review:456`)
- **Edges** = dependency relationships (arrow points from dependent to dependency)

```
Example Graph After Setup:

product:123 - depends on - review:456
product:123 - depends on - review:789
product:123 - depends on - rating:111

review:456 - depends on - comment:001
review:456 - depends on - like:002
```

**Internal Representation:**
The graph is stored as a reverse mapping for efficient invalidation:

```
dependencies = {
  'review:456': Set(['product:123']),
  'review:789': Set(['product:123']),
  'rating:111': Set(['product:123']),
  'comment:001': Set(['review:456']),
  'like:002': Set(['review:456'])
}
```

This structure allows quick lookup: "What cache keys depend on this entity?"

## Complete Scenario Walkthrough

### Initial State

```
Database:
- Product 123 has reviews [456, 789] and ratings [111]
- Review 456 has comments [001] and likes [002]

Cache: Empty
Dependencies: Empty
```

### Step 1: Cache Product

```typescript
ProductService.getProduct("123");
```

**Action:**

```typescript
cache_set({
  key: "product:123",
  depends_on: [
    { key: "review:456", depends_on: [] },
    { key: "review:789", depends_on: [] },
    { key: "rating:111", depends_on: [] },
  ],
});
```

**Result:**

```
Cache:
  product:123 -> <product data>

Dependencies:
  review:456 -> [product:123]
  review:789 -> [product:123]
  rating:111 -> [product:123]

Graph:
  product:123
  ├── review:456
  ├── review:789
  └── rating:111
```

### Step 2: Cache Review

```typescript
ReviewService.getReview("456");
```

**Action:**

```typescript
cache_set({
  key: "review:456",
  depends_on: [
    { key: "comment:001", depends_on: [] },
    { key: "like:002", depends_on: [] },
  ],
});
```

**Result:**

```
Cache:
  product:123 -> <product data>
  review:456 -> <review data>

Dependencies:
  review:456 -> [product:123]      // from step 1
  review:789 -> [product:123]
  rating:111 -> [product:123]
  comment:001 -> [review:456]      // new
  like:002 -> [review:456]         // new

Graph (multi-level):
  product:123
    ├── review:456
    │    ├──comment:001
    │    └──like:002
    ├── review:789
    └── rating:111
```

### Step 3: Update Rating

```typescript
RatingService.updateRating("111", 5);
```

**Invalidation Trace:**

```
1. cache_invalidate('rating:111')
2. Find dependents of 'rating:111' -> [product:123]
3. Mark for deletion: [product:123]
4. Recursively find dependents of 'product:123' -> []
5. Delete cache keys: [product:123]
6. Clean up dependencies for deleted keys
```

**Result:**

```
Cache:
  review:456 -> <review data>     // unchanged

Dependencies:
  review:789 -> []                // product:123 removed
  comment:001 -> [review:456]
  like:002 -> [review:456]

Graph:
    review:456
        ├──comment:001
        └──like:002

  (orphaned: review:789, rating:111)
```

**Cascade:** rating -> product (1 level up)

### Step 4: Update Like

```typescript
LikeService.updateLike("002", updates);
```

**Invalidation Trace:**

```
1. cache_invalidate('like:002')
2. Find dependents of 'like:002' -> [review:456]
3. Mark for deletion: [review:456]
4. Recursively find dependents of 'review:456' -> []
   (product:123 was already deleted, not in dependencies)
5. Delete cache keys: [review:456]
6. Clean up dependencies
```

**Result:**

```
Cache: Empty

Dependencies:
  comment:001 -> []

Graph: Empty (all nodes orphaned)
```

**Cascade:** like -> review (1 level up)

### Step 5: Add New Review (Special Case)

```typescript
ReviewService.addReview("123", reviewData);
// Creates review with id '999'
```

**Problem:** The new review:999 doesn't exist in the dependency graph yet.

**Solution:** Direct invalidation of parent

```typescript
cache_invalidate("product:123");
```

**Why This Works:**

- New entities have no dependents yet
- Parent ID is known (passed to addReview)
- Pragmatic: invalidate parent directly
- If parent is already invalid, this is a no-op

### Step 6: Update Comment (Deep Cascade)

```typescript
// Setup: Re-cache everything first
ProductService.getProduct("123"); // Caches product:123
ReviewService.getReview("456"); // Caches review:456

CommentService.updateComment("001", updates);
```

**Current Graph:**

```
  product:123
    └── review:456
        ├──comment:001
        └──like:002
```

**Invalidation Trace:**

```
1. cache_invalidate('comment:001')
2. Find dependents of 'comment:001' -> [review:456]
3. Mark for deletion: [review:456]
4. Recursively find dependents of 'review:456' -> [product:123]
5. Mark for deletion: [product:123]
6. Recursively find dependents of 'product:123' -> []
7. Delete cache keys: [review:456, product:123]
8. Clean up dependencies
```

**Result:**

```
Cache: Empty

Dependencies:
  comment:001 -> []
  like:002 -> []
```

**Cascade:** comment -> review -> product (2 levels up)

## Invalidation Algorithm

### Recursive Invalidation

```
function getAllDependents(entityKey, visited = {}):
  if entityKey in visited:
    return empty set

  visited.add(entityKey)
  allDependents = empty set

  directDependents = dependencies[entityKey]

  for each dependent in directDependents:
    allDependents.add(dependent)

    // Recursively get dependents of this dependent
    nestedDependents = getAllDependents(dependent, visited)
    allDependents.addAll(nestedDependents)

  return allDependents
```

## Patterns

### Update/Delete Pattern (Existing Entities)

```typescript
// Entity already exists in dependency graph
async updateEntity(id: string) {
  await repo.update(id, data);
  cache_invalidate(`entity:${id}`);  // Cascades up automatically
}
```

**Why it works:** Entity already has dependents registered from previous cache_set calls.

### Add Pattern (New Entities)

```typescript
// Entity doesn't exist in graph yet
async addEntity(parentId: string, data: any) {
  const entity = await repo.save({ parent: { id: parentId }, ...data });
  cache_invalidate(`parent:${parentId}`);  // Direct invalidation
  return entity;
}
```

**Why it works:** Parent ID is known, new entity has no dependents yet.

---

# How the code looks like in practice

```ts

class ProductService {
  async getProduct(id: string) {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ["reviews", "ratings"],
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    cache_set({
      key: `product:${id}`,
      depends_on: [
        ...product.reviews.map((r) => ({
          key: `review:${r.id}`,
          depends_on: [],
        })),
        ...product.ratings.map((r) => ({
          key: `rating:${r.id}`,
          depends_on: [],
        })),
      ],
    });

    return product;
  }
}

class RatingService {
  async updateRating(id: string, score: number) {
    await this.ratingRepo.update(id, { score });

    cache_invalidate(`rating:${id}`);
  }
}

class ReviewService {
  async getReview(id: string) {
    const review = await this.reviewRepo.findOne({
      where: { id },
      relations: ["comments", "likes"],
    });

    if (!review) {
      throw new NotFoundException(`Review with id ${id} not found`);
    }

    cache_set({
      key: `review:${id}`,
      depends_on: [
        ...review.comments.map((c) => ({
          key: `comment:${c.id}`,
          depends_on: [],
        })),
        ...review.likes.map((l) => ({
          key: `like:${l.id}`,
          depends_on: [],
        })),
      ],
    });

    return review;
  }

  async addReview(productId: string, reviewData: any) {
    const review = await this.reviewRepo.save({
      product: { id: productId },
      ...reviewData,
    });

    cache_invalidate(`product:${productId}`);

    return review;
  }

  async updateReview(id: string, updates: any) {
    await this.reviewRepo.update(id, updates);

    cache_invalidate(`review:${id}`);
  }
}

class LikeService {
  async addLike(reviewId: string, userId: string) {
    const like = await this.likeRepo.save({
      review: { id: reviewId },
      user: { id: userId },
    });

    cache_invalidate(`review:${reviewId}`);

    return like;
  }

  async updateLike(id: string, updates: any) {
    await this.likeRepo.update(id, updates);

    cache_invalidate(`like:${id}`);
  }

  async deleteLike(id: string) {
    await this.likeRepo.delete(id);

    cache_invalidate(`like:${id}`);
  }
}

class CommentService {
  async addComment(reviewId: string, commentData: any) {
    const comment = await this.commentRepo.save({
      review: { id: reviewId },
      ...commentData,
    });

    cache_invalidate(`review:${reviewId}`);

    return comment;
  }

  async updateComment(id: string, updates: any) {
    await this.commentRepo.update(id, updates);

    cache_invalidate(`comment:${id}`);
  }
}
```