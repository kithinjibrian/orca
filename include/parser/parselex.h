// cSpell: ignore PARSELEX
#ifndef PARSELEX_H
#define PARSELEX_H

#include "lexer.h"
#include "macros.h"

typedef struct perror
{
	int token;
	int lineno;
	int offset;
	char *text;
	int expected;
	lexer_status_e error;
	const char *filename;
} perror_t;

void *or_parse_file(FILE *fp, const char *filename,
					perror_t *error, int start);

#endif /* PARSELEX_H */