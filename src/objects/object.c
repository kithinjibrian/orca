#include "objects/objects.h"

static __INLINE__ void new_ref(object_t *obj)
{
	obj->ref = 1;
}

void or_init(object_t *obj, or_type_t *type)
{
	assert(obj != NULL);
	_or_set_type(obj, type);
	new_ref(obj);
}