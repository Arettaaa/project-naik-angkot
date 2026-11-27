from qgis.core import QgsProject, QgsDateTimeRange
from qgis.PyQt.QtCore import QDateTime, QDate, QTime

P = QgsProject.instance()
for h in range(1, 8):
    tp = P.mapLayersByName(f'hujan_acak_hari{h}')[0].temporalProperties()
    tgl = QDate(2026, 11, 15 + h)
    tp.setFixedTemporalRange(QgsDateTimeRange(
        QDateTime(tgl, QTime(0, 0, 1)), QDateTime(tgl, QTime(23, 59, 59))))
print('selesai')