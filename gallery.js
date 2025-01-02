class GalleryManager {
    constructor() {
        this.templates = [];
        this.currentPage = 1;
        this.itemsPerPage = 20;
        
        this.init();
    }

    async init() {
        // 模拟线稿数据
        this.templates = [
            {
                id: 1,
                title: "可爱小兔子",
                category: "animals",
                thumbnail: "templates/bunny_thumb.jpg",
                template: "templates/bunny.png",
                views: 1234,
                downloads: 567
            },
            {
                id: 2,
                title: "调皮小猫咪",
                category: "animals",
                thumbnail: "templates/cat_thumb.jpg",
                template: "templates/cat.png",
                views: 890,
                downloads: 234
            },
            {
                id: 3,
                title: "温馨小屋",
                category: "buildings",
                thumbnail: "templates/house_thumb.jpg",
                template: "templates/house.png",
                views: 567,
                downloads: 123
            }
        ];
        
        this.renderGallery();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // 分类点击事件
        document.querySelectorAll('.categories a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const category = e.currentTarget.getAttribute('href').split('/').pop();
                this.filterByCategory(category);
            });
        });
    }

    filterByCategory(category) {
        const filteredTemplates = category === 'all' 
            ? this.templates 
            : this.templates.filter(t => t.category === category);
        this.renderGallery(filteredTemplates);
    }

    renderGallery(templates = this.templates) {
        const gallery = document.querySelector('.gallery-grid');
        gallery.innerHTML = '';
        
        templates.forEach(template => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            item.innerHTML = `
                <div class="template-card">
                    <div class="template-image">
                        <img src="${template.thumbnail}" alt="${template.title}">
                    </div>
                    <div class="template-info">
                        <h3>${template.title}</h3>
                        <div class="template-stats">
                            <span>👁 ${template.views}</span>
                            <span>⬇ ${template.downloads}</span>
                        </div>
                        <button class="btn primary">开始填色</button>
                    </div>
                </div>
            `;
            
            item.querySelector('button').addEventListener('click', () => {
                this.openTemplate(template);
            });
            
            gallery.appendChild(item);
        });
    }

    openTemplate(template) {
        // 隐藏画廊界面
        document.querySelector('.main-content').style.display = 'none';
        // 显示填色界面
        document.querySelector('.coloring-interface').style.display = 'flex';
        
        // 加载模板到画布
        const coloringApp = window.coloringApp;
        coloringApp.loadTemplate(template.template);
    }
}

// 初始化画廊
window.addEventListener('DOMContentLoaded', () => {
    window.galleryManager = new GalleryManager();
}); 