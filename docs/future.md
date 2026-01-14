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

```ts
interface CacheDependency {
  key: string;
  depends_on: CacheDependency[];
}

class CacheDependencyManager {
  private dependencies = new Map<string, Set<string>>();

  registerDependencies(cacheKey: string, dependencies: CacheDependency[]) {
    dependencies.forEach((dep) => {
      if (!this.dependencies.has(dep.key)) {
        this.dependencies.set(dep.key, new Set());
      }
      this.dependencies.get(dep.key)!.add(cacheKey);

      if (dep.depends_on.length > 0) {
        this.registerDependencies(dep.key, dep.depends_on);
      }
    });
  }

  getAllDependents(
    entityKey: string,
    visited = new Set<string>()
  ): Set<string> {
    if (visited.has(entityKey)) return new Set();
    visited.add(entityKey);

    const allDependents = new Set<string>();
    const directDependents = this.dependencies.get(entityKey) || new Set();

    directDependents.forEach((dependent) => {
      allDependents.add(dependent);

      const nestedDependents = this.getAllDependents(dependent, visited);
      nestedDependents.forEach((nested) => allDependents.add(nested));
    });

    return allDependents;
  }

  removeDependency(cacheKey: string) {
    this.dependencies.forEach((deps) => deps.delete(cacheKey));
  }
}

const cache = new Cache();
const depManager = new CacheDependencyManager();

async function cache_get(key: string) {
  return await cache.get(key);
}

async function cache_set(config: {
  key: string;
  value: any;
  depends_on: CacheDependency[];
}) {
  await cache.set(config.key, config.value);

  depManager.registerDependencies(config.key, config.depends_on);

  console.log(
    `Cached ${config.key} with ${config.depends_on.length} dependencies`
  );
}

async function cache_invalidate(entityKey: string) {
  const dependents = depManager.getAllDependents(entityKey);

  console.log(
    `Invalidating ${entityKey}, cascading to: ${Array.from(dependents).join(
      ", "
    )}`
  );

  await Promise.all(
    Array.from(dependents).map(async (key) => {
      await cache.del(key);
      depManager.removeDependency(key);
    })
  );
}
```
