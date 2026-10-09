<template>
  <view class="page">
    <view v-if="loading" class="center"><text>加载中…</text></view>
    <block v-else>
      <view class="hero">
        <text class="name">{{ d.name }}</text>
        <text v-if="d.docNumber" class="docno">{{ d.docNumber }}</text>
      </view>

      <view class="facts">
        <view class="fact"><text class="k">类型</text><text class="v">{{ docTypeLabel(d.type) }}</text></view>
        <view class="fact"><text class="k">分类</text><text class="v">{{ d.category || '—' }}</text></view>
        <view class="fact"><text class="k">关联公司</text><text class="v">{{ companyName }}</text></view>
        <view class="fact"><text class="k">上传者</text><text class="v">{{ uploader }}</text></view>
        <view class="fact"><text class="k">签署状态</text><text class="v">{{ signStatusLabel(d.signStatus) }}</text></view>
        <view class="fact"><text class="k">上传日期</text><text class="v">{{ fmtDate(d.createdAt) }}</text></view>
        <view class="fact" v-if="d.expiresAt"><text class="k">到期日</text><text class="v" :class="{ od: isOverdue(d.expiresAt) }">{{ fmtDate(d.expiresAt) }}</text></view>
        <view class="fact" v-if="d.fileSize"><text class="k">大小</text><text class="v">{{ sizeText(d.fileSize) }}</text></view>
      </view>

      <view v-if="d.tags && d.tags.length" class="tags">
        <text v-for="t in d.tags" :key="t" class="tag">{{ t }}</text>
      </view>

      <view v-if="d.description" class="desc">
        <text class="desc-label">说明</text>
        <text class="desc-text">{{ d.description }}</text>
      </view>

      <view class="actions">
        <button class="act primary" :disabled="!hasFile || opening" @tap="openFile">{{ opening ? '打开中…' : '预览 / 打开' }}</button>
        <button class="act" :disabled="!hasFile || downloading" @tap="download">{{ downloading ? '下载中…' : '下载' }}</button>
      </view>
      <text v-if="!hasFile" class="hint">该文档无实体文件（仅元数据记录）</text>
    </block>
  </view>
</template>

<script>
import { request } from '../../utils/request.js'
import { getToken } from '../../utils/auth.js'
import { fmtDate, isOverdue, docTypeLabel, signStatusLabel } from '../../utils/format.js'

export default {
  data() {
    return {
      id: '', d: {}, loading: true, opening: false, downloading: false,
      companyName: '—', uploader: '—',
    }
  },
  computed: {
    hasFile() { return !!(this.d.filename || this.d.fileUrl) },
  },
  onLoad(opt) {
    this.id = opt.id
    this.load()
  },
  methods: {
    fmtDate, isOverdue, docTypeLabel, signStatusLabel,
    async load() {
      try {
        const body = await request('/api/documents/' + this.id)
        this.d = body.document || body || {}
        this.companyName = (this.d.company && this.d.company.name) || '—'
        this.uploader = (this.d.uploadedBy && this.d.uploadedBy.name) || '—'
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' })
      } finally {
        this.loading = false
      }
    },
    sizeText(n) {
      if (!n) return '—'
      if (n < 1024) return n + ' B'
      if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
      return (n / 1024 / 1024).toFixed(1) + ' MB'
    },
    platform() {
      try { return uni.getSystemInfoSync().platform } catch (e) { return '' }
    },
    async openFile() {
      this.opening = true
      try {
        if (this.platform() === 'h5') {
          const url = `https://claw-api-5zq7.onrender.com/api/documents/${this.id}/view`
          window.open(url, '_blank')
        } else {
          await this.fetchAndOpen('/view')
        }
      } catch (e) {
        uni.showToast({ title: e.message || '打开失败', icon: 'none' })
      } finally {
        this.opening = false
      }
    },
    async download() {
      this.downloading = true
      try {
        if (this.platform() === 'h5') {
          const url = `https://claw-api-5zq7.onrender.com/api/documents/${this.id}/download`
          window.open(url, '_blank')
        } else {
          await this.fetchAndOpen('/download')
        }
      } catch (e) {
        uni.showToast({ title: e.message || '下载失败', icon: 'none' })
      } finally {
        this.downloading = false
      }
    },
    fetchAndOpen(suffix) {
      return new Promise((resolve, reject) => {
        const token = getToken()
        uni.downloadFile({
          url: `https://claw-api-5zq7.onrender.com/api/documents/${this.id}${suffix}`,
          header: token ? { Authorization: 'Bearer ' + token } : {},
          success: (r) => {
            if (r.statusCode === 200) {
              uni.openDocument({
                filePath: r.tempFilePath,
                showMenu: true,
                success: resolve,
                fail: (err) => reject(new Error(err.errMsg || '打开失败')),
              })
            } else {
              reject(new Error('文件获取失败 (' + r.statusCode + ')'))
            }
          },
          fail: (err) => reject(new Error(err.errMsg || '下载失败')),
        })
      })
    },
  },
}
</script>

<style scoped>
.page { padding: 20rpx 24rpx 40rpx; }
.center { text-align: center; color: #64748b; padding: 160rpx 0; font-size: 30rpx; }
.hero { background: #fff; border-radius: 20rpx; padding: 30rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 12rpx rgba(15,23,42,0.04); }
.name { font-size: 34rpx; font-weight: 700; color: #0f172a; display: block; }
.docno { font-size: 24rpx; color: #64748b; margin-top: 8rpx; display: block; }
.facts { display: grid; grid-template-columns: 1fr 1fr; gap: 14rpx; margin-bottom: 16rpx; }
.fact { background: #fff; border-radius: 14rpx; padding: 16rpx; }
.k { display: block; font-size: 22rpx; color: #94a3b8; }
.v { display: block; font-size: 26rpx; color: #0f172a; margin-top: 4rpx; word-break: break-all; }
.v.od { color: #dc2626; }
.tags { display: flex; flex-wrap: wrap; margin-bottom: 16rpx; }
.tag { font-size: 22rpx; color: #64748b; background: #f1f5f9; padding: 6rpx 16rpx; border-radius: 999rpx; margin: 0 10rpx 10rpx 0; }
.desc { background: #fff; border-radius: 14rpx; padding: 20rpx; margin-bottom: 20rpx; }
.desc-label { display: block; font-size: 22rpx; color: #94a3b8; margin-bottom: 8rpx; }
.desc-text { font-size: 26rpx; color: #334155; line-height: 1.6; }
.actions { display: flex; gap: 20rpx; }
.act { flex: 1; height: 88rpx; line-height: 88rpx; border-radius: 16rpx; font-size: 28rpx; border: none; }
.act.primary { background: #2563eb; color: #fff; }
.act:not(.primary) { background: #f1f5f9; color: #334155; }
.act[disabled] { opacity: 0.5; }
.act::after { border: none; }
.hint { display: block; text-align: center; color: #94a3b8; font-size: 24rpx; margin-top: 16rpx; }
</style>
