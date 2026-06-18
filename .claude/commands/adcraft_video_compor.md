Compõe o vídeo final a partir dos clips gerados para $ARGUMENTS

> **Nota:** No pipeline atual (Nano Banana + Veo 3), a composição final é feita pelo editor externo.
> Os clips individuais por cena estão no Google Drive (`final_videos.drive_folder_url`).
> Este comando é mantido apenas para referência histórica.

Para verificar onde estão os clips de um vídeo:
```sql
SELECT drive_folder_url FROM final_videos WHERE id = '<uuid>';
```

Se precisar da pasta Drive:
```
final_videos.drive_folder_url → link para a pasta com todos os clips
```

$ARGUMENTS = final_video_id (UUID).
