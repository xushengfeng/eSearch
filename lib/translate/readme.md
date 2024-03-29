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

保存 save:

```shell
node -i en.csv
```
