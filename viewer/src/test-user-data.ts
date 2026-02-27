// 测试新的用户数据格式
import { UserData } from './lib/api';

// 模拟新的用户数据格式
export const testUserData: UserData = {
  uid: "08_d571574006f442a9b0b8e5cd1697af75049",
  dialogue: [
    "客服：您好，欢迎咨询万里汇-跨境电商-商家服务团队，我是人工客服Simmy Zhang，请问有什么可以帮到您呢？",
    "用户：日本趣天11月1日 需要全部更换日本收款账户。 你们现在可以更换了吗？",
    "客服：尊敬的客户，我们深知您对Qoo10平台11月起结算币种变更为日元的关注..."
  ],
  user_info: {
    va账号数量: 69,
    客户层级: "T4",
    登陆状态: "已登陆",
    认证等级: "L3",
    账号类型: "E_COMMERCE",
    b2x: "B2C",
    identity: "Yes"
  },
  portrait: {
    背景描述: ["用户是万里汇的商家用户，与日本Qoo10平台有业务往来，涉及跨境收款。"],
    知识盲区: ["不了解万里汇当前是否已经完成对Qoo10平台日元收款账户的支持。"],
    操作历史: [],
    问题描述: ["用户希望在Qoo10平台11月开始以日元结算之前，完成万里汇日本收款账户的更换。"]
  },
  uuid: "c5fa3a22-bb91-4388-8f88-35e4bec95c05"
};

// 验证数据访问
console.log("测试用户数据访问:");
console.log("- 用户问题:", testUserData.portrait.问题描述[0]);
console.log("- 客户层级:", testUserData.user_info.客户层级);
console.log("- VA账号数量:", testUserData.user_info.va账号数量);