/* ============================================================
   大医病理科规培助手 - Vue 组件
   依赖：Vue 3 (vue.global.js)、common.js（需先于本文件引入）
   页面只需一个 <div id="app"> 和一行 createToolApp(页面配置)
   ============================================================ */

/* ------------------------------------------------------------
 * 导航栏组件
 * 用法：<app-navbar active="disease"></app-navbar>
 * 新增页面时在 navItems 里加一项即可
 * ------------------------------------------------------------ */
const AppNavbar = {
	props: {
		active: {
			type: String,
			default: ''
		}
	},
	data() {
		return {
			navItems: [{
					key: 'disease',
					text: '📊 病种数据',
					href: 'index.html'
				},
				{
					key: 'skill',
					text: '🛠️ 技能数据',
					href: 'skills.html'
				}
			]
		};
	},
	template: `
		<nav class="navbar">
			<div class="navbar-inner">
				<div class="navbar-brand">
					<span class="logo">🧬</span>
					<span class="brand-text"><span class="brand-full">大医病理科 · </span>规培助手</span>
				</div>
				<div class="navbar-menu">
					<a v-for="item in navItems" :key="item.key"
						:class="['nav-item', { active: item.key === active }]"
						:href="item.href">{{ item.text }}</a>
				</div>
			</div>
		</nav>
	`
};

/** 页面模板 partial 文件路径（ToolPage 组件的 template 从这里加载） */
const TOOL_PAGE_TEMPLATE_URL = 'partials/tool-page.html';

/* ------------------------------------------------------------
 * 转换工具页面组件（页面头 + 三步表单 + 页脚）
 * 模板存放在 partials/tool-page.html，挂载前由 createToolApp 加载注入
 * config 配置项：
 *   title         页面标题，如「病种数据模板转换」
 *   subtitle      标题下的描述文字
 *   optionLabel   下拉框标签，如「主要诊断」/「技能操作」
 *   optionHint    下拉框下方的提示文字
 *   defaultSecondCategory 二级分类默认值（默认 '门诊诊治'）
 *   yamlKey       YAML 中选项列表的键名（'diagnoses' / 'skills'）
 *   storagePrefix localStorage 键前缀（各页面互不冲突）
 *   template      输出模板键名（'disease' / 'skill'，见 common.js TEMPLATES）
 * ------------------------------------------------------------ */
const ToolPage = {
	props: {
		config: {
			type: Object,
			required: true
		}
	},
	data() {
		return {
			// 表单字段
			name: '',
			secondCategory: this.config.defaultSecondCategory || '门诊诊治',
			visitType: '首诊',
			selectedOption: '',
			isRescue: '否',
			// 下拉选项状态：loading / ready / error
			options: [],
			optionsState: 'loading',
			optionsError: '',
			// 自定义下拉面板开关
			dropdownOpen: false,
			// 状态提示 { message, type }
			status: null,
			statusTimer: null
		};
	},
	computed: {
		// 当前页面使用的输出模板
		template_() {
			return TEMPLATES[this.config.template] || TEMPLATES.disease;
		},
		placeholderText() {
			if (this.optionsState === 'loading') return '正在加载选项配置...';
			if (this.optionsState === 'error') return '选项配置加载失败，可直接输入';
			return '点击展开列表选择，或直接输入';
		}
	},
	mounted() {
		this.restoreForm();
		this.loadOptions();
	},
	methods: {
		/* 从 localStorage 回填表单（二级分类不读取历史，每次使用页面默认值） */
		restoreForm() {
			const prefix = this.config.storagePrefix;
			const saved = {
				name: localStorage.getItem(`${prefix}_name`),
				visitType: localStorage.getItem(`${prefix}_visitType`),
				isRescue: localStorage.getItem(`${prefix}_isRescue`)
			};
			if (saved.name) this.name = saved.name;
			if (saved.visitType) this.visitType = saved.visitType;
			if (saved.isRescue) this.isRescue = saved.isRescue;
			// 下拉选中项在选项加载完成后回填（见 loadOptions）
		},

		/* 保存表单到 localStorage（二级分类不保存） */
		saveForm() {
			const prefix = this.config.storagePrefix;
			localStorage.setItem(`${prefix}_name`, this.name);
			localStorage.setItem(`${prefix}_visitType`, this.visitType);
			localStorage.setItem(`${prefix}_primaryDiagnosis`, this.selectedOption);
			localStorage.setItem(`${prefix}_isRescue`, this.isRescue);
		},

		/* 从 YAML 配置文件加载下拉选项 */
		async loadOptions() {
			try {
				const response = await fetch(CONFIG_URL);
				if (!response.ok) {
					throw new Error(`配置文件请求失败 (HTTP ${response.status})`);
				}
				const yamlText = await response.text();
				const yamlConfig = jsyaml.load(yamlText);

				const list = (yamlConfig && Array.isArray(yamlConfig[this.config.yamlKey])) ?
					yamlConfig[this.config.yamlKey] : [];
				if (list.length === 0) {
					throw new Error(`配置文件中没有找到 ${this.config.yamlKey} 列表或列表为空`);
				}

				this.options = list;
				this.optionsState = 'ready';

				// 回填上次保存的选择（需在选项渲染完成后执行）
				const savedValue = localStorage.getItem(`${this.config.storagePrefix}_primaryDiagnosis`);
				if (savedValue) this.selectedOption = savedValue;

			} catch (error) {
				console.error('加载配置失败:', error);
				this.optionsState = 'error';
				this.optionsError = error.message;
				this.showStatus(
					`❌ 配置加载失败: ${error.message}（请通过 HTTP 服务访问页面，而不是直接双击打开 html 文件）`,
					'error'
				);
			}
		},

		/* 展开/收起下拉面板（箭头按钮点击） */
		toggleDropdown() {
			this.dropdownOpen = !this.dropdownOpen;
		},

		/* 输入框失焦时收起下拉面板（选项点击用 mousedown 阻止失焦，不受影响） */
		closeDropdown() {
			this.dropdownOpen = false;
		},

		/* 选择某个选项 */
		pickOption(item) {
			this.selectedOption = item;
			this.dropdownOpen = false;
		},

		/* 显示状态提示，5 秒后自动隐藏 */
		showStatus(message, type) {
			this.status = {
				message,
				type
			};
			if (this.statusTimer) clearTimeout(this.statusTimer);
			this.statusTimer = setTimeout(() => {
				this.status = null;
			}, 5000);
		},

		/* 点击按钮：处理并下载 */
		async processFile() {
			const fileInput = this.$refs.sourceFile;

			if (!fileInput.files.length) {
				this.showStatus('请选择源数据文件！', 'error');
				return;
			}

			// 检查必填项
			if (!this.name || !this.secondCategory || !this.visitType || !this.selectedOption || !this.isRescue) {
				this.showStatus('请填写所有必填项！', 'error');
				return;
			}

			// 处理前保存表单到本地存储
			this.saveForm();

			const template = this.template_;

			try {
				this.showStatus('正在处理文件...', 'info');

				const file = fileInput.files[0];
				const data = await readFileAsArrayBuffer(file);
				const workbook = XLSX.read(data, {
					type: 'array'
				});

				// 获取第一个工作表
				const firstSheetName = workbook.SheetNames[0];
				const worksheet = workbook.Sheets[firstSheetName];

				// 将工作表转换为 JSON
				let jsonData = XLSX.utils.sheet_to_json(worksheet, {
					header: 1
				});

				// 假设第一行为标题，过滤掉最后一行统计信息
				const headers = jsonData[0];
				const dataRows = jsonData.slice(1, -1); // 去掉第一行标题和最后一行统计

				// 查找所需列的索引
				const medicalRecordNoIndex = headers.indexOf('住院号');
				const patientNameIndex = headers.indexOf('姓名');
				const visitDateIndex = headers.indexOf('登记时间'); // 假设日期列为"登记时间"

				if (medicalRecordNoIndex === -1 || patientNameIndex === -1 || visitDateIndex === -1) {
					throw new Error('源文件缺少必要的列：住院号、姓名、登记时间');
				}

				// --- 创建模板列名 -> 列下标 的索引映射表 ---
				const COLUMN_INDEX = {};
				template.columns.forEach((colName, index) => {
					COLUMN_INDEX[colName] = index;
				});

				// 创建新数据
				const newRows = [];

				// 使用 Set 作为哈希表来存储已经出现过的病历号
				const seenMedicalRecordNos = new Set();
				let duplicateCount = 0; // 计数器

				dataRows.forEach(row => {
					const medicalRecordNo = row[medicalRecordNoIndex];
					const patientName = row[patientNameIndex];
					let visitDate = formatExcelDate(row[visitDateIndex]);

					// 如果病历号为空，或者已经在 Set 中存在，则跳过该行（只保留第一次出现的）
					if (!medicalRecordNo || seenMedicalRecordNos.has(medicalRecordNo)) {
						duplicateCount++; // 发现重复，计数+1
						return;
					}
					seenMedicalRecordNos.add(medicalRecordNo);

					// 计算计划开始日期 (月份的第一天)
					const planStartDate = getFirstDayOfMonth(visitDate);

					// 创建新行数据
					const newRow = new Array(template.columns.length).fill("");

					// 待填充的数据字段
					const fieldValues = {
						name: this.name,
						planStartDate: planStartDate,
						secondCategory: this.secondCategory,
						medicalRecordNo: medicalRecordNo,
						patientName: patientName,
						visitDate: visitDate,
						visitType: this.visitType,
						option: this.selectedOption,
						isRescue: this.isRescue
					};

					// 按模板映射填充各列
					Object.keys(template.mapping).forEach(fieldKey => {
						const colName = template.mapping[fieldKey];
						newRow[COLUMN_INDEX[colName]] = fieldValues[fieldKey];
					});

					// 填充固定值列（如技能模板的「主要诊断」统一为"其他病种"）
					if (template.constants) {
						Object.keys(template.constants).forEach(colName => {
							newRow[COLUMN_INDEX[colName]] = template.constants[colName];
						});
					}

					newRows.push(newRow);
				});

				// 创建结果工作簿
				const resultWorkbook = XLSX.utils.book_new();

				// 准备最终数据：标题行 + 列名行 + 数据行
				const titleRow = [template.title];
				const columnHeaders = template.columns;

				const finalData = [titleRow, columnHeaders, ...newRows];

				const resultWorksheet = XLSX.utils.aoa_to_sheet(finalData, {
					header: 1
				});
				XLSX.utils.book_append_sheet(resultWorkbook, resultWorksheet, "Sheet1");

				// 组成文件名 生成并下载文件
				const optionPrefix = this.selectedOption ? this.selectedOption.substring(0, 5) : "未选项";
				const dynamicFileName = `${this.name}_${optionPrefix}_批量导入.xls`;
				XLSX.writeFile(resultWorkbook, dynamicFileName);

				this.showStatus(`✅ 处理完成！共处理 ${newRows.length} 条记录（已自动去重 ${duplicateCount} 条）。文件已下载。`, 'success');

			} catch (error) {
				console.error('处理文件时出错:', error);
				this.showStatus(`❌ 处理失败: ${error.message}`, 'error');
			}
		}
	},
	// template 在挂载前由 createToolApp() 从 partials/tool-page.html 加载注入
};

/* ------------------------------------------------------------
 * 创建并挂载一个工具页面应用
 * 先从 partials/tool-page.html 加载页面模板，注入 ToolPage 组件后再挂载
 * @param {Object} config 页面配置（navKey + ToolPage 的 config）
 * ------------------------------------------------------------ */
async function createToolApp(config) {
	const appRoot = document.getElementById('app');

	let templateHtml;
	try {
		const response = await fetch(TOOL_PAGE_TEMPLATE_URL);
		if (!response.ok) {
			throw new Error(`页面模板请求失败 (HTTP ${response.status})`);
		}
		templateHtml = await response.text();
	} catch (error) {
		console.error('加载页面模板失败:', error);
		appRoot.innerHTML =
			'<div class="page"><div class="status error" style="display:block">' +
			`❌ 页面模板加载失败: ${error.message}（请通过 HTTP 服务访问页面，而不是直接双击打开 html 文件）` +
			'</div></div>';
		return;
	}

	// 克隆组件定义并注入加载到的模板，避免污染原始定义
	const ToolPageWithTemplate = Object.assign({}, ToolPage, {
		template: templateHtml
	});

	const app = Vue.createApp({
		components: {
			AppNavbar,
			ToolPage: ToolPageWithTemplate
		},
		data() {
			return {
				pageConfig: config
			};
		},
		template: `
			<app-navbar :active="pageConfig.navKey"></app-navbar>
			<tool-page :config="pageConfig"></tool-page>
		`
	});
	app.mount('#app');
}
