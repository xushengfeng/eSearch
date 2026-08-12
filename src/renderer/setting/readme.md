创建设置项流程

遵循AGENTS.md前置类型操作

在变量`s`中添加设置项，返回的el应该使用`dkh-ui`创建，`sv`和`gv`类型匹配设置

有一些常用ui，如`xNumber`返回设置数值ui，`xSwitch`是开关，其`gv`类型兼容`boolean`，还有如`xColor` `xPath` `xSecret` `xFont` `sortList` `dialogB`。`xGroup`仅用于排版布局，类似flexbox。

注意元素onchange事件要能触发

然后在`main`中添加进设置的key

可以通过`bind`添加修改某些项后触发其他项页面更新，或者`bindF`触发具体函数。`bindF2`规定哪些项更新后触发重启app提示等。

如果要获取某个设置项，是用`getSet`而不是`store.get`，尽量不设置其他设置项，必要时使用`setSet`设置

添加、修改、删除文字都要触发AGENTS.md的翻译流程