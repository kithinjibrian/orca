#ifndef LEXER_H
#define LEXER_H

#include <stdio.h>
#include <ctype.h>
#include <stdlib.h>
#include <string.h>

#include "bitmap.h"
#include "macros.h"

#define BUFFER_SIZE 1024

// cSpell:disable
#define ENDMARKER 0
#define NAME 1
#define NUMBER 2
#define STRING 3
#define NEWLINE 4
#define INDENT 5
#define DEDENT 6
#define LPAR 7
#define RPAR 8
#define LSQB 9
#define RSQB 10
#define COLON 11
#define COMMA 12
#define SEMI 13
#define PLUS 14
#define MINUS 15
#define STAR 16
#define SLASH 17
#define VBAR 18
#define AMPER 19
#define LESS 20
#define GREATER 21
#define EQUAL 22
#define DOT 23
#define PERCENT 24
#define BACKQUOTE 25
#define LBRACE 26
#define RBRACE 27
#define EQEQUAL 28
#define NOTEQUAL 29
#define LESSEQUAL 30
#define GREATEREQUAL 31
#define TILDE 32
#define CIRCUMFLEX 33
#define LEFTSHIFT 34
#define RIGHTSHIFT 35
#define DOUBLESTAR 36
#define PLUSEQUAL 37
#define MINEQUAL 38
#define STAREQUAL 39
#define SLASHEQUAL 40
#define PERCENTEQUAL 41
#define AMPEREQUAL 42
#define VBAREQUAL 43
#define CIRCUMFLEXEQUAL 44
#define LEFTSHIFTEQUAL 45
#define RIGHTSHIFTEQUAL 46
#define DOUBLESTAREQUAL 47
#define DOUBLESLASH 48
#define DOUBLESLASHEQUAL 49
#define AT 50
#define RARROW 51
#define ELLIPSIS 52
#define PLUSPLUS 53
#define MINUSMINUS 54
#define OP 55
#define ERRORTOKEN 56
#define N_TOKENS 57

// cSpell:enable

typedef enum
{
	E_OK = 0,
	E_EOF,
	E_EOL,
	E_NOMEM,
} lexer_status_e;

typedef struct token
{
	FILE *fp;
	int level;
	int lineno;
	char *buffer;  /* input buffer*/
	char *current; /* next character in buffer*/
	char *inp;	   /*end of data in buffer*/
	char *end;	   /* end of input buffer */
	char *start;   /* start of current token*/
	lexer_status_e done;
	const char *filename;
	const char *line_start; /* pointer to start of current line*/
} token_t;

token_t *or_lexer_from_file(FILE *fp);
void or_lexer_free(token_t *token);
int token_get(token_t *token, char **start, char **end);

#endif /* LEXER_H */