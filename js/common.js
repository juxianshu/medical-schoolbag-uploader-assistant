/* ============================================================
   大医病理科规培助手 - 公共数据与工具函数
   供 Vue 组件(components.js)调用
   依赖：SheetJS(xlsx)、js-yaml（需先于本文件引入）
   ============================================================ */

/** 下拉选项 YAML 配置文件路径（所有页面共用同一个文件） */
const CONFIG_URL = 'config/options.yaml';

/* ------------------------------------------------------------
 * 输出模板定义
 * 每套模板包含：
 *   title   - 输出文件第一行的模板标题
 *   columns - 输出文件的列名数组（顺序即列顺序）
 *   mapping - 数据字段 -> 模板列名 的映射
 *             可选字段：name(填表人姓名) / planStartDate(转计划开始时间) /
 *             secondCategory(二级分类) / medicalRecordNo(病历号) /
 *             patientName(病人姓名) / visitDate(就诊/操作日期) /
 *             visitType(就诊类型) / option(下拉选中项) / isRescue(是否抢救)
 * ------------------------------------------------------------ */
const TEMPLATES = {
	// 病种数据模板（登记手册病种数据模板 6.4.220913）
	disease: {
		title: '登记手册病种数据模板（版本：6.4.220913）',
		columns: [
			"姓名*", "手机号", "转计划开始时间*", "二级分类*", "医师类型",
			"病历号*", "病人姓名*", "是否对应HIS系统患者", "床位号", "是否对应HIS系统病例",
			"就诊日期*", "就诊类型*", "主要诊断*", "次要诊断", "内容",
			"全程管理", "入院日期", "出院日期", "书写大病历", "是否肛肠专科住院志",
			"参与角色", "是否抢救*", "抢救内容", "转归情况", "望闻问切",
			"辅助检查", "处方", "医嘱"
		],
		mapping: {
			name: "姓名*",
			planStartDate: "转计划开始时间*",
			secondCategory: "二级分类*",
			medicalRecordNo: "病历号*",
			patientName: "病人姓名*",
			visitDate: "就诊日期*",
			visitType: "就诊类型*",
			option: "主要诊断*",
			isRescue: "是否抢救*"
		}
	},

	// 技能数据模板（登记手册技能数据模板 6.4.220913）
	skill: {
		title: '登记手册技能数据模板（版本：6.4.220913）',
		columns: [
			"姓名*", "手机号", "转计划开始时间*", "二级分类*", "病历号",
			"病人姓名", "是否对应HIS系统患者", "床位号", "是否对应HIS系统病例",
			"操作日期*", "技能操作*", "技能操作内容", "主要诊断", "内容",
			"是否抢救*", "抢救内容", "转归情况"
		],
		mapping: {
			name: "姓名*",
			planStartDate: "转计划开始时间*",
			secondCategory: "二级分类*",
			medicalRecordNo: "病历号",
			patientName: "病人姓名",
			visitDate: "操作日期*", // 操作日期使用源数据的登记时间
			option: "技能操作*",
			isRescue: "是否抢救*"
		}
	}
};

function readFileAsArrayBuffer(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = e => resolve(e.target.result);
		reader.onerror = e => reject(new Error('读取文件失败'));
		reader.readAsArrayBuffer(file);
	});
}

function getFirstDayOfMonth(dateStr) {
	const parts = dateStr.split('/');
	if (parts.length >= 2) {
		return `${parts[0]}/${parts[1]}/01`;
	}
	return dateStr;
}

/**
 * 将 Excel 的序列号（数字）或日期对象转换为 "YYYY/MM/DD" 字符串
 * @param {number|Date|string} excelDate - 可能是数字、Date对象或字符串
 * @returns {string} 格式化后的日期，例如 "2026/04/19"
 */
function formatExcelDate(excelDate) {
	if (!excelDate) return "";

	// 情况 A: 如果是数字 (例如 46120.37...)
	if (typeof excelDate === 'number') {
		// Excel 日期基准是 1899-12-30 (注意不是 1900-01-01，这是为了兼容 Lotus 1-2-3 的 bug)
		// 86400000 是一天的毫秒数
		const dateObj = new Date((excelDate - 25569) * 86400 * 1000);

		const y = dateObj.getFullYear();
		const m = (dateObj.getMonth() + 1).toString().padStart(2, '0');
		const d = dateObj.getDate().toString().padStart(2, '0');
		return `${y}/${m}/${d}`;
	}

	// 情况 B: 如果已经是 Date 对象
	if (excelDate instanceof Date) {
		const y = excelDate.getFullYear();
		const m = (excelDate.getMonth() + 1).toString().padStart(2, '0');
		const d = excelDate.getDate().toString().padStart(2, '0');
		return `${y}/${m}/${d}`;
	}

	// 情况 C: 如果已经是字符串 (防止误判)
	// 简单处理：把横杠换成斜杠，去掉时间部分
	if (typeof excelDate === 'string') {
		return excelDate.replace(/-/g, '/').split(' ')[0];
	}

	return String(excelDate);
}
