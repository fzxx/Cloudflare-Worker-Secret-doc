# Cloudflare Worker Secret doc
秘密文档是一款极简、开源的在线文档。
## 使用方法

1. 打开 Cloudflare - Workers和Pages - 创建 - 创建Workers，名称保持默认或者随意设置，点击部署，然后编辑代码，把原来的代码删除，然后把仓库里 `workers.js` 的内容复制并粘贴到代码处，点击部署；
2. 新建一个KV，名称随意，进入刚才新建的workers，点击设置 - 绑定 - 添加 - KV命名空间，变量名称填 `works_data` 找到刚新建的KV，KV命名空间选择刚才创建的KV，点击保存即可使用Cloudflare提供的默认域名访问。
3. 自定义域名：添加域名到Cloudflare后，Workers和Pages - 找到秘密文档的workers - 设置 - 域和路由 -自定义域，添加自己域名即可；例如：你的域名是 doc.com 那么可以添加 mimi.doc.com
