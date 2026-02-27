from rest_framework import serializers
from .models import ConversationAnnotation, AnnotationBatch


class ConversationAnnotationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConversationAnnotation
        fields = '__all__'


class AnnotationBatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnnotationBatch
        fields = '__all__'