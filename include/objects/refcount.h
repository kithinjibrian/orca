#ifndef REFCOUNT_H
#define REFCOUNT_H

#include <string.h>
#include <stdlib.h>

#include "macros.h"
#include "objects.h"

static __INLINE__ void _or_incref(object_t *obj)
{
	if (obj)
		obj->ref++;
}

#define or_incref(obj) _or_incref(or_object_cast(obj))

// cSpell:ignore decref
static __INLINE__ void _or_decref(object_t *obj)
{
	if (obj && --obj->ref == 0)
		free(obj);
}

#define or_decref(obj) _or_decref(or_object_cast(obj))

/**
 * or_clear - decreases the reference count and sets the pointer to NULL
 * @param obj: pointer to object
 */
#define or_clear(obj)                                   \
	do                                                  \
	{                                                   \
		object_t **tmp_ptr = cast(object_t **, &(obj)); \
		if (*tmp_ptr)                                   \
		{                                               \
			or_decref(*tmp_ptr);                        \
		}                                               \
		object_t *null = NULL;                          \
		memcpy(tmp_ptr, &null, sizeof(object_t *));     \
	} while (0)

static __INLINE__ void drop(void *ptr)
{
	void *object = (*(void **)ptr);

	if (object)
	{
		or_decref(object);
	}
}

/**
 * SMART - decreases the reference count of an object when it goes out of scope
 */
#define SMART cleanup(drop)

#endif /* REFCOUNT_H */