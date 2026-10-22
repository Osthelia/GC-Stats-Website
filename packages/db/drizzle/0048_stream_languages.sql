INSERT INTO "news_languages" ("code", "name", "sort_order", "is_active") VALUES
	('pt_BR', 'Português (Brasil)', 9, true),
	('es_MX', 'Español (México)', 10, true),
	('zh_CN', '简体中文', 11, true),
	('zh_TW', '繁體中文', 12, true),
	('ko', '한국어', 13, true),
	('fil', 'Filipino', 14, true),
	('id', 'Bahasa Indonesia', 15, true),
	('th', 'ไทย', 16, true),
	('vi', 'Tiếng Việt', 17, true)
ON CONFLICT ("code") DO NOTHING;
