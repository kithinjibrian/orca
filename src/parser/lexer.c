#include "parser/lexer.h"

// cspell:ignore ERRORTOKEN
// cSpell:disable
char *token_names[] = {
	"LPAR",
	"RPAR",
	"PLUS",
	"DOT",
	"STAR",
	"LESS",
	"MINUS",
	"SLASH",
	"COMMA",
	"COLON",
	"EQUAL",
	"NUMBER",
	"LBRACE",
	"RBRACE",
	"STRING",
	"GREATER",
	"NEWLINE",
	"EQEQUAL",
	"ELLIPSIS",
	"NOTEQUAL",
	"LESSEQUAL",
	"LEFTSHIFT",
	"RIGHTSHIFT",
	"SEMICOLON",
	"GREATEREQUAL",
};
// cSpell:enable

token_t *new_token(void)
{
	token_t *token = malloc(sizeof(token_t));

	if (!token)
		return NULL;

	token->buffer =		 /* NULL */
		token->current = /* NULL */
		token->end =	 /* NULL */
		token->inp =	 /* NULL */
		token->start = NULL;

	token->done = E_OK;
	token->fp = NULL;
	token->level = 0;
	token->lineno = 0;
	token->filename = NULL;

	return token;
}

// cSpell:disable
int one_char(int c)
{
	switch (c)
	{
	case '(':
		return LPAR;
	case ')':
		return RPAR;
	case '[':
		return LSQB;
	case ']':
		return RSQB;
	case ':':
		return COLON;
	case ',':
		return COMMA;
	case ';':
		return SEMI;
	case '+':
		return PLUS;
	case '-':
		return MINUS;
	case '*':
		return STAR;
	case '/':
		return SLASH;
	case '|':
		return VBAR;
	case '&':
		return AMPER;
	case '<':
		return LESS;
	case '>':
		return GREATER;
	case '=':
		return EQUAL;
	case '.':
		return DOT;
	case '%':
		return PERCENT;
	case '{':
		return LBRACE;
	case '}':
		return RBRACE;
	case '^':
		return CIRCUMFLEX;
	case '~':
		return TILDE;
	case '@':
		return AT;
	case '\n':
		return NEWLINE;
	default:
		return OP;
	}
}

int two_char(int c1, int c2)
{
	switch (c1)
	{
	case '=':
		switch (c2)
		{
		case '=':
			return EQEQUAL;
		}
		break;
	case '!':
		switch (c2)
		{
		case '=':
			return NOTEQUAL;
		}
		break;
	case '<':
		switch (c2)
		{
		case '=':
			return LESSEQUAL;
		case '<':
			return LEFTSHIFT;
		}
		break;
	case '>':
		switch (c2)
		{
		case '=':
			return GREATEREQUAL;
		case '>':
			return RIGHTSHIFT;
		}
		break;
	case '+':
		switch (c2)
		{
		case '+':
			return PLUSPLUS;
		case '=':
			return PLUSEQUAL;
		}
		break;
	case '-':
		switch (c2)
		{
		case '-':
			return MINUSMINUS;
		case '=':
			return MINEQUAL;
		case '>':
			return RARROW;
		}
		break;
	case '*':
		switch (c2)
		{
		case '*':
			return DOUBLESTAR;
		case '=':
			return STAREQUAL;
		}
		break;
	case '/':
		switch (c2)
		{
		case '=':
			return SLASHEQUAL;
		}
		break;
	case '|':
		switch (c2)
		{
		case '=':
			return VBAREQUAL;
		}
		break;
	case '%':
		switch (c2)
		{
		case '=':
			return PERCENTEQUAL;
		}
		break;
	case '&':
		switch (c2)
		{
		case '=':
			return AMPEREQUAL;
		}
		break;
	case '^':
		switch (c2)
		{
		case '=':
			return CIRCUMFLEXEQUAL;
		}
		break;
	default:
		goto def;
	}

def:
	return OP;
}

int three_char(int c1, int c2, int c3)
{
	switch (c1)
	{
	case '<':
		switch (c2)
		{
		case '<':
			switch (c3)
			{
			case '=':
				return LEFTSHIFTEQUAL;
			}
			break;
		}
		break;
	case '>':
		switch (c2)
		{
		case '>':
			switch (c3)
			{
			case '=':
				return RIGHTSHIFTEQUAL;
			}
			break;
		}
		break;
	case '*':
		switch (c2)
		{
		case '*':
			switch (c3)
			{
			case '=':
				return DOUBLESTAREQUAL;
			}
			break;
		}
		break;
	case '/':
		switch (c2)
		{
		case '/':
			switch (c3)
			{
			case '=':
				return DOUBLESLASHEQUAL;
			}
			break;
		}
		break;
	case '.':
		switch (c2)
		{
		case '.':
			switch (c3)
			{
			case '.':
				return ELLIPSIS;
			}
			break;
		}
		break;
	default:
		goto def;
	}

def:
	return OP;
}

// cSpell:enable

static void
token_backup(token_t *token, int c)
{
	if (c != EOF)
	{
		if (--token->current < token->buffer)
		{
			printf("tok_backup: begin of buffer\n");
			exit(1);
		}

		if (*token->current != c)
			*token->current = c;
	}
}

static char *
_fgets(char *s, int size, token_t *token)
{
	return fgets(s, size, token->fp);
}

static int
_feof(token_t *token)
{
	return feof(token->fp);
}

static int
token_next(token_t *token)
{
	INFINITE_LOOP
	{
		/* Not reached end of line */
		if (token->current != token->inp)
		{
			return charmask(*(token->current++));
		}

		ssize_t cur = 0;

		if (token->start == NULL)
		{
			if (token->buffer == NULL)
			{
				token->buffer = malloc(BUFSIZ);
				if (token->buffer == NULL)
				{
					token->done = E_NOMEM;
					return EOF;
				}
				token->end = token->buffer + BUFSIZ;
			}

			if (_fgets(token->buffer, (int)(token->end - token->buffer), token) == NULL)
			{
				token->done = E_EOF;
				return EOF;
			}
			else
			{
				token->done = E_OK;
				token->inp = strchr(token->buffer, '\0');
			}
		}
		else
		{
			cur = token->current - token->buffer;
			if (_feof(token))
			{
				token->done = E_EOF;
			}
		}

		token->lineno++;

		if (token->buffer != NULL)
		{
			token->current = token->buffer + cur;
			token->line_start = token->current;
		}

		if (token->done != E_OK)
		{
			token->current = token->inp;
			return EOF;
		}
	}

	return EOF;
}

int token_get(token_t *token, char **start, char **end)
{
	int c;
	*start = *end = NULL;

start:
	token->start = NULL;

	do
	{
		c = token_next(token);
	} while (c == ' ');

	if (c == '/')
	{
		c = token_next(token);
		if (c == '/')
			while (c != EOF && c != '\n')
				c = token_next(token);
		else if (c == '*')
		{
			c = token_next(token);

			while (c != EOF)
			{
				if (c == '*')
				{
					c = token_next(token);
					if (c == '/')
					{
						c = token_next(token);
						break;
					}
				}
				else
				{
					c = token_next(token);
				}
			}

			if (c == EOF)
			{
				token->done = E_EOF;
				token->current = token->inp;
				return ERRORTOKEN;
			}
		}
		else
		{
			token_backup(token, c);
			c = '/';
		}
	}

	if (c == EOF)
	{
		return token->done = E_EOF ? ENDMARKER : ERRORTOKEN;
	}

	if (c == '\n')
	{
		goto start;
	}

	token->start = token->current - 1;

	if (c == '.')
	{
		c = token_next(token);
		if (isdigit(c))
			goto fraction;
		else if (c == '.')
		{
			c = token_next(token);
			if (c == '.')
			{
				*start = token->start;
				*end = token->current;
				return ELLIPSIS;
			}
			else
			{
				token_backup(token, c);
			}
			token_backup(token, c);
		}
		else
		{
			token_backup(token, c);
		}

		*start = token->start;
		*end = token->current;
		return DOT;
	}

	if (isdigit(c))
	{
		while (isdigit(c))
		{
			c = token_next(token);
		}

		if (c == '.')
		{
		fraction:
			do
			{
				c = token_next(token);
			} while (isdigit(c));
		}

		token_backup(token, c);

		*start = token->start;
		*end = token->current;
		return NUMBER;
	}

	if (isalpha(c) || c == '_')
	{
		while (isalpha(c) || c == '_')
		{
			c = token_next(token);
		}

		token_backup(token, c);

		*start = token->start;
		*end = token->current;

		return NAME;
	}

	if (c == '\'' || c == '"')
	{
		int quote = c;
		c = token_next(token);

		while (c != quote && c != EOF)
		{
			if (c == '\\')
				c = token_next(token);

			if (c == '\n')
			{
				token->done = E_EOL;
				goto error_str;
			}

			c = token_next(token);
		}

		if (c == EOF)
		{
			token->done = E_EOF;
		error_str:
			token->current = token->inp;
			return ERRORTOKEN;
		}

		*start = token->start;
		*end = token->current;
		return STRING;
	}

	{
		int c2 = token_next(token);
		int tok = two_char(c, c2);

		if (tok != OP)
		{
			int c3 = token_next(token);
			int tok3 = three_char(c, c2, c3);

			if (tok3 != OP)
			{
				tok = tok3;
			}
			else
			{
				token_backup(token, c3);
			}

			*start = token->start;
			*end = token->current;
			return tok;
		}

		token_backup(token, c2);
	}

	*start = token->start;
	*end = token->current;
	return one_char(c);
}

token_t *or_lexer_from_file(FILE *fp)
{
	token_t *token = new_token();
	if (!token)
		return NULL;

	if ((token->buffer = malloc(BUFSIZ)) == NULL)
	{
		or_lexer_free(token);
		return NULL;
	}

	token->current = token->inp = token->buffer;
	token->end = token->buffer + BUFSIZ;

	token->fp = fp;

	return token;
}

void or_lexer_free(token_t *token)
{
	if (token->buffer != NULL && token->fp != NULL)
		free(token->buffer);
	free(token);
}