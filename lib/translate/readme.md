# 翻译 Translate

创建 csv，指定存在的语言进行编辑或指定新语言
Create a csv, specify an existing language for editing or specify a new language

> [!TIP]
> 选项`-a`用于输出全部文字。如果你发现原来的翻译存在不足，需要修改，请使用这一选项。如果你需要跟进翻译，即 eSearch 的某些文字已经修改，但翻译未修改，请不使用这一选项
>
> The option `- a` is used to output all text. If you find that the original translation is inadequate and need to be modified, please use this option. If you need to follow up on the translation, that is, some text in eSearch has been modified, but the translation has not been modified, please do not use this option

```shell
node -l en
# en.csv
# 或 or
node -l en -a
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

## 标记翻译进度

`tool.js`定义了 srcCommit，借助 git 的 diff 功能，来方便地了解需要翻译什么内容。翻译完某个 id 后，将其添加到对应语言的`finishId`，再次输出 csv 时，将忽略他，这样可以专注与未翻译/修改的翻译。如果全部翻译完，请把 srcCommit 的`id`改为当前提交的 commit id，并清空`finishId`

`tool.js` defines srcCommit. With the diff feature of git, you can easily understand what needs to be translated. After translating an id, add it to the `finishiId` of the corresponding language, and ignore it when you output csv again, so that you can focus on the untranslated / modified translation. If you have finished the translation, please change the `id` of srcCommit to the currently submitted commit id and clear `finishiId`
