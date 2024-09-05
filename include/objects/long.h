#ifndef LONG_H
#define LONG_H

#include <assert.h>
#include <stddef.h>
#include <stdlib.h>
#include <stdio.h>

#include "type.h"
#include "ortype.h"
#include "objects.h"

typedef struct _long
{
	u32_t *digit;
} _long_t;

typedef struct or_long
{
	OR_OBJECT_HEAD;
	_long_t value;
} or_long_t;

or_long_t *new_or_long(ssize_t size);
void or_long_from_long(long value);

#endif /* LONG_H */