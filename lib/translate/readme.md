# 翻译 Translate

创建 csv，指定存在的语言进行编辑或指定新语言
Create a csv, specify an existing language for editing or specify a new language

> [!TIP]
> 若要翻译未翻译的文字，可以添加`-w`输出部分 csv，程序会自动合并，你只需关心翻译。若要修改已翻译的文字，则不能添加`-w`。
>
> To translate untranslated text, you can add the `- w` output part csv, the program will automatically merge, you only need to care about the translation. If you want to modify translated text, you cannot add `- w`.

```shell
node -l en
# en.csv
# 或 or
node -l en -w
```

编辑 edit

> [!TIP]
> AI prompt：以下是 csv 文件，把第二列翻译成 en 并复制到第三列

保存 save:

```shell
node -i en.csv
```

只有在 source.json 里定义的文字才能被翻译。如果找不到需要翻译的文字，那可能是我没针对某些页面进行国际化，请在 issue 上提交 bug，指明需要国际化位置

Only words defined in source.json can be translated. If you can't find the text that needs to be translated, it may be that I have not internationalized some pages. Please submit bug on issue to indicate the location where you need to be internationalized.
