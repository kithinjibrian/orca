#include "parser/parselex.h"

static void
init_error(perror_t *error, const char *filename)
{
	error->filename = filename;
	error->lineno = 0;
	error->offset = 0;
	error->text = NULL;
	error->expected = -1;
	error->error = E_OK;
	error->token = -1;
}

// cSpell: ignore parselex ERRORTOKEN
static void *
parselex(token_t *token, perror_t *error, int start)
{
	(void)error;
	(void)start;
	int started = 0;

	int ch = 0;
	while (ch < 5)
	{
		size_t len;
		int type;
		char *a, *b;
		char *str;
		type = token_get(token, &a, &b);

		if (type == ERRORTOKEN)
		{
			error->error = token->done;
			break;
		}

		if (type == ENDMARKER && started)
		{
			printf("ENDMARKER: %d\n", token->done);
		}
		else
			started = 1;

		len = b - a;
		str = malloc(len + 1);

		if (str == NULL)
		{
			fprintf(stderr, "Out of memory for next token\n");
			error->error = E_NOMEM;
			break;
		}

		if (len > 0)
			strncpy(str, a, len);
		str[len] = '\0';

		printf("len: %ld, str: %s\n", len, str);

		ch++;
	}

	return NULL;
}

void *or_parse_file(FILE *fp, const char *filename,
					perror_t *error, int start)
{
	token_t *token;

	init_error(error, filename);

	if ((token = or_lexer_from_file(fp)) == NULL)
	{
		return NULL;
	}

	token->filename = filename;

	return parselex(token, error, start);
}