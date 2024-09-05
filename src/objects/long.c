#include "objects/long.h"

or_type_t long_type = {
	.name = "int",
};

or_long_t *new_or_long(ssize_t size)
{
	assert(size >= 0);

	or_long_t *obj;

	size_t total_size = sizeof(or_long_t) + (size) * sizeof(u32_t);
	obj = malloc(total_size);

	if (!obj)
		return NULL;

	or_init(or_object_cast(obj), &long_type);

	return obj;
}

static __INLINE__ size_t count_digits(long value)
{
	size_t num_digits = 0;
	while (value != 0)
	{
		value >>= 32;
		num_digits++;
	}

	return num_digits == 0 ? 1 : num_digits;
}

void or_long_from_long(long value)
{
	printf("%ld\n", count_digits(value));
}