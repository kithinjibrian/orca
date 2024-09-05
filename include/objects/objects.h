#ifndef OBJECTS_H
#define OBJECTS_H

#include <stddef.h>
#include <assert.h>

#include "type.h"
#include "ortype.h"
#include "macros.h"

#define or_object_cast(op) cast(object_t *, (op))

#define OR_OBJECT_HEAD object_t base

/**
 * or_object_init - initialize an object
 * @param _type: object type
 */
#define or_object_init(_type) \
	{                         \
		.ref = 1,             \
		.type = _type,        \
	}

typedef struct object
{
	size_t ref;
	or_type_t *type;
} object_t;

static __INLINE__ or_type_t *_or_type(object_t *obj)
{
	return obj->type;
}

#define or_type(obj) _or_type(or_object_cast(obj))

static __INLINE__ bool_e _or_is_type(object_t *ob, or_type_t *type)
{
	return or_type(ob) == type;
}

#define or_is_type(obj, type) _or_is_type(or_object_cast(obj), type)

static __INLINE__ void _or_set_type(object_t *obj, or_type_t *type)
{
	obj->type = type;
}

#define or_set_type(obj, type) _or_set_type(or_object_cast(obj), type)

void or_init(object_t *obj, or_type_t *type);

#endif /* OBJECTS_H */