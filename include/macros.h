#ifndef MACROS_H
#define MACROS_H

#define cast(type, expr) ((type)(expr))

#define __UNUSED__ __attribute__((unused))

#define __PACKED__ __attribute__((packed))

#define cleanup(func) __attribute__((cleanup(func)))
#define __INLINE__ inline __attribute__((always_inline))
#define __MUST_CHECK__ __attribute__((warn_unused_result));
#define section(section) __attribute__((__section__(section)))

#endif /* MACROS_H */