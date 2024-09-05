#ifndef TYPE_H
#define TYPE_H

typedef signed char s8_t;
typedef signed int s32_t;
typedef signed long s64_t;
typedef signed short s16_t;
typedef signed long ssize_t;

typedef unsigned char u8_t;
typedef unsigned int u32_t;
typedef unsigned long u64_t;
typedef unsigned short u16_t;
typedef unsigned long size_t;

typedef const char *string_t;

/**
 * void_fun - void function pointer
 * This pointer can point to any function.
 * Remember to cast it to the correct type
 */
typedef void (*void_fun)(void);

typedef enum
{
	FALSE = 0,
	TRUE
} bool_e;

#endif /* TYPE_H */